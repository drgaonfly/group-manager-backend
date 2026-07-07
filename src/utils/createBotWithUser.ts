import bcrypt from 'bcrypt';
import axios from 'axios';
import Bot, { IBot } from '../models/bot';
import User from '../models/user';
import Role from '../models/role';
import { getBotInfoWithGramjs } from './getBotInfoWithGramjs';
import { IdGen } from './idGen';
import { generateUserInviteCode } from './generateUserInviteCode';
import { IBotUser } from '../models/botUser';
import createDebug from 'debug';

const debug = createDebug('bot:createBotWithUser');

/**
 * 创建一个新的 Bot，并为其单独创建一个后台 User 账号（代理角色）。
 * 账号邮箱 = @username@bot.local，密码 = username（用户自己知道，登录后改）
 *
 * @param token      新机器人的 Telegram Bot Token
 * @param currentBot 母机器人（克隆来源），用于关联 proxy、clonedFrom
 * @param botUser    操作者的 BotUser（提供 userName 作为账密来源）
 */
export async function createBotWithUser(
  token: string,
  currentBot: IBot | null,
  botUser: IBotUser | null,
): Promise<any> {
  try {
    debug('[createBotWithUser] token:', token);

    // 1. 检查 token 是否已被占用
    const botExists = await Bot.findOne({ token });
    if (botExists) {
      return {
        success: false,
        message: '该 Bot Token 已被使用，请使用其他 Token',
      };
    }

    // 2. 尝试获取机器人信息
    let botInfo: { username?: string; firstName?: string; id?: string } | null =
      null;
    try {
      botInfo = await getBotInfoWithGramjs(token);
      debug('[createBotWithUser] 获取机器人信息:', botInfo);
    } catch (e) {
      debug('[createBotWithUser] 获取机器人信息失败，继续创建:', e);
    }

    // 3. 用操作者 Telegram username 作为账密
    //    username 可能带 @ 前缀，统一去掉
    const rawUsername = (botUser?.userName || '').replace(/^@/, '');
    if (!rawUsername) {
      return {
        success: false,
        message: '无法获取您的 Telegram 用户名，请先设置 username 后再试',
      };
    }

    const newUserId = await IdGen.next(User, 'id', 6);
    const email = `${rawUsername}@bot.local`;
    const plainPassword = rawUsername; // 密码 = username，简单易记，用户登录后自改

    // 检查用户是否已存在，如果存在则复用
    let newUser = await User.findOne({ email });
    if (!newUser) {
      // 用户不存在，创建新用户
      const salt = await bcrypt.genSalt(10);
      const hashPassword = await bcrypt.hash(plainPassword, salt);
      const inviteCode = await generateUserInviteCode();
      const proxyRole = await Role.findOne({ name: '代理' });

      newUser = new User({
        id: newUserId,
        email,
        password: hashPassword,
        inviteCode,
        name: botInfo?.firstName || botInfo?.username || rawUsername,
        live: true,
        proxy: currentBot?.user ?? null,
        roles: proxyRole ? [proxyRole._id] : [],
      });
      await newUser.save();
      debug('[createBotWithUser] 新 User 已创建:', newUser._id);
    } else {
      debug('[createBotWithUser] 复用现有 User:', newUser._id);
    }

    // 4. 创建新 Bot，绑定到新 User，类型固定为 private（克隆产物，不可再克隆）
    // 设置默认免费使用时间（从环境变量读取，默认30天）
    const defaultFreeDays = parseInt(process.env.DEFAULT_FREE_DAYS || '30', 10);
    const disabledAt = new Date();
    disabledAt.setDate(disabledAt.getDate() + defaultFreeDays);

    const newBot = new Bot({
      token,
      user: newUser._id,
      clonedFrom: currentBot?._id ?? null,
      creator: botUser?._id ?? null,
      owner: botUser?._id ?? null, // 克隆者自动成为 owner
      isOnline: true,
      type: 'private',
      disabledAt,
      ...(botInfo && {
        userName: botInfo.username || '',
        botName: botInfo.firstName || botInfo.username || '',
        id: botInfo.id || '',
      }),
    });
    await newBot.save();
    debug('[createBotWithUser] 新 Bot 已保存:', newBot._id);

    // 5. 调后端接口异步设置 Webhook，不阻塞主流程
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5007';
    axios
      .post(`${backendUrl}/api/bots/${newBot._id}/set-webhook`)
      .catch((e: any) => {
        debug('[createBotWithUser] set-webhook 接口调用失败:', e?.message);
      });

    // 6. 将操作者 BotUser 加入新 Bot 的用户列表
    if (botUser) {
      await Bot.findByIdAndUpdate(
        newBot._id,
        { $addToSet: { botUsers: botUser._id } },
        { new: true },
      );
    }

    // 7. 用新 bot token 获取 JWT，生成自动登录链接
    let jwtToken: string;
    try {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:5007';
      const res = await axios.post(`${backendUrl}/api/auth/bot-login`, {
        botToken: token,
      });
      jwtToken = res.data?.token ?? null;
    } catch (e: any) {
      debug('[createBotWithUser] 获取 JWT 失败:', e?.message);
    }

    const adminUrl = process.env.ADMIN_URL || '';
    const redirect = encodeURIComponent(`/bots/${newBot._id}`);
    const loginUrl = jwtToken
      ? `${adminUrl}/user/login?jwtToken=${encodeURIComponent(
          jwtToken,
        )}&redirect=${redirect}`
      : null;

    return {
      success: true,
      account: {
        email,
        password: plainPassword,
        newBot_id: newBot._id,
        loginUrl,
      },
    };
  } catch (e: any) {
    debug('[createBotWithUser] 发生异常:', e);
    return { success: false, message: e?.message || '创建机器人失败' };
  }
}
