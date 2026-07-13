import { MyContext } from '../types';
import { InlineKeyboard } from 'grammy';
import createDebug from 'debug';

const debug = createDebug('bot:groupAdminPrompt');

/**
 * 群组管理员提示中间件
 * 当机器人被设置为群管时，自动发送私聊设置提示
 */
export const groupAdminPrompt = async (
  ctx: MyContext,
  next: () => Promise<void>,
) => {
  const chatType = ctx.chat?.type;
  const bot = ctx.currentBot;

  // 只在群组或超级群组中处理
  if (chatType !== 'group' && chatType !== 'supergroup') {
    return next();
  }

  // 检查机器人是否在群组中
  if (!ctx.chat?.id || !bot) {
    return next();
  }

  try {
    // 获取机器人在群组中的成员信息
    const botId = parseInt(bot.id, 10);
    const chatMember = await ctx.getChatMember(botId);

    // 检查机器人是否是管理员（can_promote_members, can_restrict_members, can_change_info, can_delete_messages 等权限）
    const isAdmin =
      chatMember.status === 'administrator' || chatMember.status === 'creator';

    if (isAdmin) {
      const messageText = [
        `请前往机器人聊天页面呼出设置，避免后台链接泄露`,
      ].join('\n');

      const inlineKeyboard = new InlineKeyboard().url(
        '🔗 转跳私聊设置',
        `https://t.me/${bot.userName}`,
      );

      await ctx.reply(messageText, { reply_markup: inlineKeyboard });
      debug(
        `机器人 ${bot.userName} 在群组 ${ctx.chat.id} 中是管理员，已发送提示`,
      );
      return; // 发送提示后不继续处理
    }
  } catch (error) {
    debug(`检查机器人管理员状态失败: ${error}`);
  }

  return next();
};
