import bcrypt from 'bcrypt';
import Bot, { IBot } from '../models/bot';
import User from '../models/user';
import Role from '../models/role';
import BotUser from '../models/botUser';
import { setWebhook } from '../controllers/botController';
import { getBotInfoWithGramjs } from './getBotInfoWithGramjs';
import { IdGen } from './idGen';
import { generatePassword } from './generatePassword';
import { generateUserInviteCode } from './generateUserInviteCode';
import { IBotUser } from '../models/botUser';
import createDebug from 'debug';

const debug = createDebug('bot:createBotWithUser');

export interface CreateBotResult {
  success: boolean;
  message?: string;
  account?: { email: string; password: string };
}

/**
 * 创建一个新的 Bot，并为其单独创建一个后台 User 账号（代理角色）。
 *
 * @param token      新机器人的 Telegram Bot Token
 * @param currentBot 母机器人（克隆来源），用于关联 proxy、clonedFrom
 * @param botUser    操作者的 BotUser（记录 creator）
 */
export async function createBotWithUser(
  token: string,
  currentBot: IBot | null,
  botUser: IBotUser | null,
): Promise<CreateBotResult> {
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

    // 3. 生成新 User 账号信息
    const newUserId = await IdGen.next(User, 'id', 6);
    const tokenId = token.split(':')[0]; // token 数字部分，全局唯一
    const email = `user_${newUserId}@${tokenId}.bot`; // 完全唯一，不依赖机器人信息

    const plainPassword = generatePassword();
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(plainPassword, salt);
    const inviteCode = await generateUserInviteCode();

    const proxyRole = await Role.findOne({ name: '代理' });

    const newUser = new User({
      id: newUserId,
      email,
      password: hashPassword,
      inviteCode,
      name: botInfo?.firstName || botInfo?.username || `Bot ${tokenId}`,
      live: true,
      proxy: currentBot?.user ?? null, // 挂在母机器人所属 User 下
      roles: proxyRole ? [proxyRole._id] : [],
    });
    await newUser.save();
    debug('[createBotWithUser] 新 User 已创建:', newUser._id);

    // 4. 创建新 Bot，绑定到新 User
    const newBot = new Bot({
      token,
      user: newUser._id,
      clonedFrom: currentBot?._id ?? null,
      creator: botUser?._id ?? null,
      isOnline: true,
      ...(botInfo && {
        userName: botInfo.username || '',
        botName: botInfo.firstName || botInfo.username || '',
        id: botInfo.id || '',
      }),
    });
    await newBot.save();
    debug('[createBotWithUser] 新 Bot 已保存:', newBot._id);

    // 5. 设置 Webhook
    await setWebhook(newBot);

    // 6. 将操作者 BotUser 加入新 Bot 的用户列表
    if (botUser) {
      await Bot.findByIdAndUpdate(
        newBot._id,
        { $addToSet: { botUsers: botUser._id } },
        { new: true },
      );
    }

    return { success: true, account: { email, password: plainPassword } };
  } catch (e: any) {
    debug('[createBotWithUser] 发生异常:', e);
    return { success: false, message: e?.message || '创建机器人失败' };
  }
}
