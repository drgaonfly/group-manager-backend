import axios from 'axios';
import { MyContext } from '../../../types';
import { Composer, InlineKeyboard } from 'grammy';
import { startClientAndGetSession } from '../../../services/gramClient';
import { checkStartAllowedChats } from '../../../middlewares/checkInBot';
import { handleJoinLottery } from './handleLottery';
import { formatBeijingDate } from '../../../../utils/formatBeijingDate';
import Bot from '../../../../models/bot';

import createDebug from 'debug';

const startCommand = new Composer<MyContext>();
const debug = createDebug('bot:start');

/**
 * 用 Bot Token 换取后台 JWT
 * authorizedBotUserId: 被授权人的 BotUser._id，传入时生成带授权标记的 token
 */
async function getBotJwt(
  botToken: string,
  authorizedBotUserId?: string,
): Promise<string | null> {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5010';
    const res = await axios.post(`${backendUrl}/api/auth/bot-login`, {
      botToken,
      ...(authorizedBotUserId ? { authorizedBotUserId } : {}),
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
    const publicJwt = await getBotJwt(bot.token);
    if (publicJwt) {
      const telegramUserId = ctx.from?.id?.toString() || '';
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
    // 只有 owner 才能看到登录按钮和订阅按钮
    const ownerIdStr = bot.owner?.toString();
    const currentBotUserIdStr = ctx.currentBotUser?._id?.toString();

    const isOwner =
      ownerIdStr && currentBotUserIdStr && ownerIdStr === currentBotUserIdStr;

    const jwt = await getBotJwt(bot.token);

    if (isOwner) {
      // 非 owner 显示错误消息

      // owner 显示登录和订阅按钮
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
          .text('💎 订阅服务', 'subscription_start')
          .text('🔐 授权他人管理', `authorize_${ctx.currentBot._id}`);
      }
    } else if (
      ctx.currentBot.authorized_users.some(
        (id: any) => id.toString() === ctx.currentBotUser._id.toString(),
      )
    ) {
      // 是不是 authorizer，传入 authorizedBotUserId 生成带授权标记的 token
      const jwt = await getBotJwt(bot.token, ctx.currentBotUser._id.toString());
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
          .row();
      }
    } else {
      const message = [
        `此机器人为他人专属克隆机器人，您无法使用。`,
        ``,
        `请点击下方按钮前往主机器人可免费克隆自己的专属机器人。`,
        ``,
      ].join('\n');

      // 公共机器人
      const public_bot = await Bot.findOne({ type: 'public' });

      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().url(
          '🤖免费克隆专属机器人',
          `https://t.me/${public_bot.userName}`,
        ),
      });
      return;
    }
  }

  // 发送欢迎消息
  await ctx.reply(messageText, { reply_markup: inlineKeyboard });
});

export default startCommand;
