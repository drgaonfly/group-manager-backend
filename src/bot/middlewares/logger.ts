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
  const message = ctx.message;

  debug(message);
  let messageType: string;
  switch (true) {
    case !!message?.text:
      messageType = 'text';
      break;
    case !!message?.photo:
      messageType = 'photo';
      break;
    case !!message?.video:
      messageType = 'video';
      break;
    case !!message?.voice:
      messageType = 'voice';
      break;
    case !!message?.document:
      messageType = 'document';
      break;
    case !!message?.sticker:
      messageType = 'sticker';
      break;
    case !!message?.location:
      messageType = 'location';
      break;
    case !!message?.entities?.some((entity) => entity.type === 'mention'):
      messageType = 'mention';
      break;
    default:
      messageType = '未知消息类型';
  }

  let messageContent = message?.text;

  debug('message: ', message);

  if (
    message?.photo ||
    message?.video ||
    message?.document ||
    message?.animation
  ) {
    try {
      const file = await ctx.getFile();
      messageContent = `https://api.telegram.org/file/bot${ctx.currentBot.token}/${file.file_path}`;
    } catch (err) {
      debug('获取文件路径失败:', err);
    }
  }

  // 如果消息包含@提及，添加被提及的用户信息
  if (message?.entities?.some((entity) => entity.type === 'mention')) {
    const mentions = message.entities
      .filter((entity) => entity.type === 'mention')
      .map(
        (entity) =>
          message?.text?.substring(
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

  const from = message?.from;
  const chat = message?.chat;

  if (!ctx.callbackQuery) {
    if (process.env.NOT_RECEIVER_MESSAGE !== 'true') {
      axios.post('https://account-backend.2025fc.xyz/api/receive-message', {
        message_id: message?.message_id, // Telegram 消息ID
        id: from?.id, // 发送者id; // 发送者id
        is_bot: from?.is_bot, // 是否是机器人;
        first_name: from?.first_name, // 发送者first_name
        last_name: from?.last_name, // 发送者last_name
        username: from?.username, // 发送者username
        language_code: from?.language_code, // 发送者language_code
        chat_id: chat?.id, // 聊天id
        chat_type: chat?.type,
        chat_title: chat?.title,
        date: message?.date, // 消息时间戳（秒）
        messageType, // 消息类型，如 text, image, command 等
        content: messageContent, // 消息内容
      });
    }
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
