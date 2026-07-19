import { Middleware } from 'grammy';
import { MyContext } from '../../types';
import { InlineKeyboard } from 'grammy';
import createDebug from 'debug';

const debug = createDebug('bot:group:adminPrompt');

/**
 * Bot 被提升为管理员提示中间件
 * 职责：
 * 1. 检测 Bot 被提升为管理员或群主
 * 2. 发送设置提示消息
 *
 * 注意：
 * - 只处理 my_chat_member 事件
 * - Bot 状态变为 administrator 或 creator 时触发
 */
export const botAdminPromptHandler: Middleware<MyContext> = async (
  ctx,
  next,
) => {
  const myChatMemberUpdate = ctx.myChatMember;

  // 只处理 Bot 自己的 chat_member 事件
  if (!myChatMemberUpdate) {
    return await next();
  }

  const chat = ctx.chat || myChatMemberUpdate.chat;

  // 只处理群组和超级群组
  if (chat.type !== 'group' && chat.type !== 'supergroup') {
    return await next();
  }

  const oldStatus = myChatMemberUpdate.old_chat_member.status;
  const newStatus = myChatMemberUpdate.new_chat_member.status;

  // 检测 Bot 被提升为管理员或群主
  const isBotPromotedToAdmin =
    ['member', 'left', 'kicked'].includes(oldStatus) &&
    ['administrator', 'creator'].includes(newStatus);

  if (isBotPromotedToAdmin) {
    const bot = ctx.currentBot;

    try {
      const messageText = '请前往机器人聊天页面呼出设置，避免后台链接泄露';

      const inlineKeyboard = new InlineKeyboard().url(
        '🔗 转跳私聊设置',
        `https://t.me/${bot.userName}`,
      );

      await ctx.reply(messageText, { reply_markup: inlineKeyboard });

      debug(
        `✅ 机器人 ${bot.userName} 在群组 ${chat.id} 中被设置为管理员，已发送提示`,
      );
    } catch (error) {
      debug(`❌ 处理群组管理员提示失败: ${error}`);
    }
  }

  await next();
};
