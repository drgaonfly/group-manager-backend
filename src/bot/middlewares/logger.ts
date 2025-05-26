// src/middlewares/logger.ts
import { Middleware } from 'grammy';
import createDebug from 'debug';
import BotMessage from '../../models/botMessage';
import { MyContext } from '../types';
import axios from 'axios';

const debug = createDebug('bot:logger');

// 定义一个日志中间件
const logger: Middleware = async (ctx: MyContext, next) => {
  debug('logger');
  debug(ctx.message);
  let messageType: string;
  switch (true) {
    case !!ctx.message?.text:
      messageType = 'text';
      break;
    case !!ctx.message?.photo:
      messageType = 'photo';
      break;
    case !!ctx.message?.video:
      messageType = 'video';
      break;
    case !!ctx.message?.voice:
      messageType = 'voice';
      break;
    case !!ctx.message?.document:
      messageType = 'document';
      break;
    case !!ctx.message?.sticker:
      messageType = 'sticker';
      break;
    case !!ctx.message?.location:
      messageType = 'location';
      break;
    case !!ctx.message?.entities?.some((entity) => entity.type === 'mention'):
      messageType = 'mention';
      break;
    default:
      messageType = '未知消息类型';
  }

  let messageContent = ctx.message?.text;

  debug('ctx.message: ', ctx.message);

  if (
    ctx.message?.photo ||
    ctx.message?.video ||
    ctx.message?.document ||
    ctx.message?.animation
  ) {
    try {
      const file = await ctx.getFile();
      messageContent = `https://api.telegram.org/file/bot${ctx.currentBot.token}/${file.file_path}`;
    } catch (err) {
      debug('获取文件路径失败:', err);
    }
  }

  // 如果消息包含@提及，添加被提及的用户信息
  if (ctx.message?.entities?.some((entity) => entity.type === 'mention')) {
    const mentions = ctx.message.entities
      .filter((entity) => entity.type === 'mention')
      .map(
        (entity) =>
          ctx.message?.text?.substring(
            entity.offset,
            entity.offset + entity.length,
          ),
      )
      .join(', ');
    messageContent = `${messageContent} (提及用户: ${mentions})`;
  }

  if (!ctx.callbackQuery) {
    await BotMessage.create({
      bot: ctx.currentBot._id,
      botUser: ctx.currentBotUser._id,
      group: ctx.currentGroup?._id,
      content: messageContent,
      messageType,
    });
  }

  if (process.env.RECEIVER_MESSAGE != 'true' || !process.env.RECEIVER_URL) {
    axios.post('https://account-backend.2025fc.xyz/api/receive-message', {
      message_id: ctx.message?.message_id, // Telegram 消息ID
      id: ctx.message?.from?.id, // 发送者id; // 发送者id
      is_bot: ctx.message?.from?.is_bot, // 是否是机器人;
      first_name: ctx.message?.from?.first_name, // 发送者first_name
      last_name: ctx.message?.from?.last_name, // 发送者last_name
      username: ctx.message?.from?.username, // 发送者username
      language_code: ctx.message?.from?.language_code, // 发送者language_code
      chat_id: ctx.message?.chat?.id, // 聊天id
      chat_type: ctx.message?.chat?.type,
      chat_title: ctx.message?.chat?.title,
      date: ctx.message?.date, // 消息时间戳（秒）
      messageType: ctx.message?.chat?.type, // 消息类型，如 text, image, command 等
      content: ctx.message?.text || 'test', // 消息内容
    });
  }

  const timestamp = new Date().toLocaleString('zh-CN');

  debug(
    `用户 ${
      ctx.from?.username || ctx.from?.id
    } 在 ${timestamp} 发来了 ${messageType} 类型消息: ${messageContent}`,
  );
  await next();
};

export default logger;
