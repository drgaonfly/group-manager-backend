import axios from 'axios';
import { MyContext } from '../../../types';
import { Composer, InlineKeyboard } from 'grammy';
import { startClientAndGetSession } from '../../../services/gramClient';
import { checkStartAllowedChats } from '../../../middlewares/checkInBot';
import { handleJoinLottery } from './handleLottery';
import { formatBeijingDate } from '../../../../utils/formatBeijingDate';

import createDebug from 'debug';

const startCommand = new Composer<MyContext>();
const debug = createDebug('bot:start');

/**
 * 用 Bot Token 换取后台 JWT
 * @param botToken Bot Token
 * @param tgUserId Telegram 用户 ID（可选）
 */
async function getBotJwt(
  botToken: string,
  tgUserId?: string,
): Promise<string | null> {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5010';
    const res = await axios.post(`${backendUrl}/api/auth/bot-login`, {
      botToken,
      ...(tgUserId ? { tgUserId } : {}),
    });
    return res.data?.token ?? null;
  } catch (e: any) {
    debug('[getBotJwt] 失败:', e?.message);
    return null;
  }
}

startCommand.command('start', checkStartAllowedChats, async (ctx) => {
  debug('start');

  const bot = ctx.currentBot;
  const startParam = ctx.match as string;
  const adminUrl = process.env.ADMIN_URL || '';
  const chatType = ctx.chat?.type;

  // ── deep link 参数处理 ─────────────────────────────────────────────────────

  if (startParam?.startsWith('join-')) {
    const code = startParam.replace('join-', '');
    if (code) {
      await handleJoinLottery(ctx, code);
      return;
    }
  }

  // ── 群组中显示提示消息 ─────────────────────────────────────────────────────
  if (chatType === 'group' || chatType === 'supergroup') {
    const messageText = [`请前往机器人聊天页面呼出设置，避免后台链接泄露`].join(
      '\n',
    );

    const inlineKeyboard = new InlineKeyboard().url(
      '🔗 转跳私聊设置',
      `https://t.me/${bot.userName}`,
    );

    await ctx.reply(messageText, { reply_markup: inlineKeyboard });
    return;
  }

  // ── 初始化 session ─────────────────────────────────────────────────────────
  if (!bot.session) {
    const session = await startClientAndGetSession(bot.token);
    bot.session = session as any;
    await bot.save();
  }

  // ── 构建回复 ───────────────────────────────────────────────────────────────
  const messageText = [
    `嗨！ ${bot.botName} 能帮助你方便地安全管理你的群组，是 TG 上最完善的机器人！`,
    ``,
    `将我添加到超级群组并授予管理员权限，这样我才能进行操作！`,
    ``,
    `有效期截至 ${formatBeijingDate(bot.disabledAt)}`,
    ``,
    `点击 /help 查看所有指令及使用方法。`,
  ].join('\n');

  const inlineKeyboard = new InlineKeyboard().url(
    '➕ 把我加到群组',
    `https://t.me/${bot.userName}?startgroup=start`,
  );

  if (bot.type === 'public') {
    // ── public bot ─────────────────────────────────────────────────────────
    // 传递 Telegram 用户 ID 用于后端过滤群组
    const telegramUserId = ctx.from?.id?.toString() || '';
    const publicJwt = await getBotJwt(bot.token, telegramUserId);
    if (publicJwt) {
      const redirect = encodeURIComponent(
        `/bots/${bot._id}?tgUserId=${telegramUserId}`,
      );
      const webappLoginUrl = `${adminUrl}/webapp/login?jwtToken=${encodeURIComponent(
        publicJwt,
      )}&redirect=${redirect}`;
      const urlLoginUrl = `${adminUrl}/user/login?jwtToken=${encodeURIComponent(
        publicJwt,
      )}&redirect=${redirect}`;
      debug('[start] webappLoginUrl:', webappLoginUrl);
      debug('[start] urlLoginUrl:', urlLoginUrl);
      inlineKeyboard
        .row()
        .webApp('🖥️ 小程序后台设置', webappLoginUrl)
        .url('🌐 网页后台设置', urlLoginUrl)
        .row()
        .text('🤖 克隆专属机器人', 'clone_start');
    }
  } else if (bot.type === 'private') {
    // ── private bot ────────────────────────────────────────────────────────
    // Owner 可以看所有功能
    // 其他用户：需要在群里是管理员才能管理对应的群（统一逻辑）
    const ownerIdStr = bot.owner?.toString();
    const currentBotUserIdStr = ctx.currentBotUser?._id?.toString();

    const isOwner =
      ownerIdStr && currentBotUserIdStr && ownerIdStr === currentBotUserIdStr;

    if (isOwner) {
      // Owner 显示登录和订阅按钮
      const jwt = await getBotJwt(bot.token);
      if (jwt) {
        const redirect = encodeURIComponent(`/bots/${bot._id}`);
        const webappLoginUrl = `${adminUrl}/webapp/login?jwtToken=${encodeURIComponent(
          jwt,
        )}&redirect=${redirect}`;
        const urlLoginUrl = `${adminUrl}/user/login?jwtToken=${encodeURIComponent(
          jwt,
        )}&redirect=${redirect}`;
        debug('[start] webappLoginUrl:', webappLoginUrl);
        debug('[start] urlLoginUrl:', urlLoginUrl);
        inlineKeyboard
          .row()
          .webApp('🖥️ 小程序后台设置', webappLoginUrl)
          .url('🌐 网页后台设置', urlLoginUrl)
          .row()
          .text('💎 订阅服务', 'subscription_start');
      }
    } else {
      // 非 Owner：提供登录入口，后台会根据群组权限过滤和校验
      const telegramUserId = ctx.from?.id?.toString() || '';
      const jwt = await getBotJwt(bot.token, telegramUserId);
      if (jwt) {
        const redirect = encodeURIComponent(
          `/bots/${bot._id}?tgUserId=${telegramUserId}`,
        );
        const webappLoginUrl = `${adminUrl}/webapp/login?jwtToken=${encodeURIComponent(
          jwt,
        )}&redirect=${redirect}`;
        const urlLoginUrl = `${adminUrl}/user/login?jwtToken=${encodeURIComponent(
          jwt,
        )}&redirect=${redirect}`;
        debug('[start] webappLoginUrl:', webappLoginUrl);
        debug('[start] urlLoginUrl:', urlLoginUrl);
        inlineKeyboard
          .row()
          .webApp('🖥️ 小程序后台设置', webappLoginUrl)
          .url('🌐 网页后台设置', urlLoginUrl);
      }
    }
  }

  // 发送欢迎消息
  await ctx.reply(messageText, { reply_markup: inlineKeyboard });
});

export default startCommand;
