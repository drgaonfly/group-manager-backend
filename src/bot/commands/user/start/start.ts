import { Composer, InlineKeyboard } from 'grammy';
import axios from 'axios';
import { MyContext } from '../../../types';
import { startClientAndGetSession } from '../../../services/gramClient';
import { checkStartAllowedChats } from '../../../middlewares/checkInBot';
import { handleJoinLottery } from './handleLottery';
import { handlePromotion } from './handlePromotion';
import { handleMySuccess } from './handleMySuccess';
import { findBotProxy } from '../../../services/findBotProxy';
import { PermissionChecker } from '../../../utils/permissionChecker';
import createDebug from 'debug';

const startCommand = new Composer<MyContext>();
const debug = createDebug('bot:start');

/**
 * 用 Bot Token 换取后台 JWT
 * 在 Bot 端（可信环境）调用，不对外暴露
 */
async function getBotJwt(botToken: string): Promise<string | null> {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5007';
    const res = await axios.post(`${backendUrl}/api/auth/bot-login`, {
      botToken,
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

  // ── deep link 参数处理 ─────────────────────────────────────────────────────

  if (startParam?.startsWith('join-')) {
    const code = startParam.replace('join-', '');
    if (code) {
      await handleJoinLottery(ctx, code);
      return;
    }
  }

  // ── 初始化 session ─────────────────────────────────────────────────────────
  if (!bot.session) {
    const session = await startClientAndGetSession(bot.token);
    bot.session = session as any;
    await bot.save();
  }

  // ── 构建回复 ───────────────────────────────────────────────────────────────
  const messageText = [
    `嗨！ ${bot.botName} 能幫助你方便地安全管理你的群組，是 TG 上最完善的機器人！`,
    ``,
    `將我添加到超級群組並授予管理員權限，這樣我才能進行操作！`,
    ``,
    `點擊 /help 查看所有指令及使用方法。`,
  ].join('\n');

  const inlineKeyboard = new InlineKeyboard().url(
    '➕ 把我加到群组',
    `https://t.me/${bot.userName}?startgroup=start`,
  );

  if (bot.type === 'public') {
    // ── public bot ─────────────────────────────────────────────────────────
    // 用 bot token 换 JWT，redirect 带上 username 过滤该用户的群
    const jwt = await getBotJwt(bot.token);
    if (jwt) {
      const username = ctx.currentBotUser?.userName || '';
      const redirect = encodeURIComponent(
        `/bots/${bot._id}/${encodeURIComponent(username)}`,
      );
      const loginUrl = `${adminUrl}/user/login?jwtToken=${encodeURIComponent(
        jwt,
      )}&redirect=${redirect}`;
      inlineKeyboard
        .row()
        .url('🖥️ 访问管理后台', loginUrl)
        .row()
        .text('🤖 克隆专属机器人', 'clone_start');
    }
  } else if (bot.type === 'private') {
    // ── private bot ────────────────────────────────────────────────────────
    // 只有 owner 才能看到登录按钮
    const ownerIdStr = bot.owner?.toString();
    const currentBotUserIdStr = ctx.currentBotUser?._id?.toString();
    const isOwner =
      ownerIdStr && currentBotUserIdStr && ownerIdStr === currentBotUserIdStr;

    if (isOwner) {
      const jwt = await getBotJwt(bot.token);
      if (jwt) {
        const redirect = encodeURIComponent(`/bots/${bot._id}`);
        const loginUrl = `${adminUrl}/user/login?jwtToken=${encodeURIComponent(
          jwt,
        )}&redirect=${redirect}`;
        inlineKeyboard.row().url('🖥️ 登录管理后台', loginUrl);
      }
    }
    // 非 owner 不显示任何额外按钮
  }

  await ctx.reply(messageText, { reply_markup: inlineKeyboard });
});

export default startCommand;
