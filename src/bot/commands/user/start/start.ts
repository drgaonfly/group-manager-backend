import axios from 'axios';
import Bot from '../../../../models/bot';
import Group from '../../../../models/group';
import { MyContext } from '../../../types';
import { Composer, InlineKeyboard } from 'grammy';
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

  // ── 构建回复 ───────────────────────────────────────────────────────────────
  const cloneHint =
    bot.type === 'public'
      ? [
          ``,
          `🤖直接发送机器人API克隆同款机器人，或点击下方按钮一键创建克隆同款机器人。`,
        ].join('\n')
      : '';

  const messageText = [
    `嗨！ ${bot.botName} 能帮助你方便地安全管理你的群组，是 TG 上最完善的机器人！`,
    ``,
    `将我添加到超级群组并授予管理员权限，这样我才能进行操作！`,
    ``,
    bot.type === 'private'
      ? `有效期截至 ${formatBeijingDate(bot.disabledAt)}`
      : '',
    cloneHint,
    ``,
    `点击 /help 查看所有指令及使用方法。`,
  ].join('\n');

  // 默认的 "把我加到群组" 按钮（Owner 和 Public Bot 用户可以看到）
  const inlineKeyboard = new InlineKeyboard();

  if (bot.type === 'public') {
    // ── public bot ─────────────────────────────────────────────────────────
    // 公共机器人：所有用户都能添加到群组
    inlineKeyboard.url(
      '➕ 把我加到群组',
      `https://t.me/${bot.userName}?startgroup=start`,
    );

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
        .url('🤖 克隆专属机器人', `https://t.me/newbot/${bot.userName}`);
    }
  } else if (bot.type === 'private') {
    // ── private bot ────────────────────────────────────────────────────────
    // Owner 可以看所有功能
    // 其他用户：需要在群里是管理员才能管理对应的群（统一逻辑）
    const ownerIdStr = bot.owner?.toString();
    const currentBotUserIdStr = ctx.currentBotUser?._id?.toString();

    const isOwner =
      ownerIdStr && currentBotUserIdStr && ownerIdStr === currentBotUserIdStr;

    debug('ownerIdStr', ownerIdStr, 'currentBotUserIdStr', currentBotUserIdStr);

    if (isOwner) {
      // Owner：可以添加到群组 + 显示登录和订阅按钮
      inlineKeyboard.url(
        '➕ 把我加到群组',
        `https://t.me/${bot.userName}?startgroup=start`,
      );

      const telegramUserId = ctx.from?.id?.toString() || '';
      const jwt = await getBotJwt(bot.token, telegramUserId);
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
          .text('👥 授权他人管理', 'how_to_grant_admin');
      }
    } else {
      // 非 owner：检查是否是该 bot 下任意群的 operator
      const telegramUserId = ctx.from?.id?.toString() || '';
      const botUserDoc = ctx.currentBotUser;

      const isOperator = botUserDoc
        ? (await Group.countDocuments({
            bot: bot._id,
            operators: botUserDoc._id,
          })) > 0
        : false;

      if (isOperator) {
        // Operator：只显示后台登录按钮，不能添加到群组
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

          // 查找公共机器人，提供克隆入口
          const public_bot = await Bot.findOne({ type: 'public' });

          inlineKeyboard
            .row()
            .webApp('🖥️ 小程序后台管理', webappLoginUrl)
            .url('🌐 网页后台管理', urlLoginUrl);

          // 如果有公共机器人，添加克隆按钮
          if (public_bot) {
            inlineKeyboard
              .row()
              .url(
                '🤖 克隆自己的专属机器人',
                `https://t.me/${public_bot.userName}`,
              );
          }
        }
      } else {
        const message = [
          `此机器人为他人专属克隆机器人，您无法使用。`,
          ``,
          `请点击下方按钮前往主机器人可免费克隆自己的专属机器人。`,
          ``,
        ].join('\n');

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
  }

  // 发送欢迎消息
  await ctx.reply(messageText, { reply_markup: inlineKeyboard });
});

export default startCommand;
