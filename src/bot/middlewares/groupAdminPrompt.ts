import { MyContext } from '../types';
import { InlineKeyboard } from 'grammy';
import createDebug from 'debug';

const debug = createDebug('bot:groupAdminPrompt');

/**
 * 群组管理员提示事件处理器
 * 当机器人被设置为群管时（my_chat_member 事件），自动发送私聊设置提示
 */
export const groupAdminPromptHandler = async (ctx: MyContext) => {
  const bot = ctx.currentBot;

  const chat = ctx.chat;

  try {
    const messageText = [`请前往机器人聊天页面呼出设置，避免后台链接泄露`].join(
      '\n',
    );

    const inlineKeyboard = new InlineKeyboard().url(
      '🔗 转跳私聊设置',
      `https://t.me/${bot.userName}`,
    );

    await ctx.reply(messageText, { reply_markup: inlineKeyboard });
    debug(
      `机器人 ${bot.userName} 在群组 ${chat.id} 中被设置为管理员，已发送提示`,
    );
  } catch (error) {
    debug(`处理群组管理员提示失败: ${error}`);
  }
};
