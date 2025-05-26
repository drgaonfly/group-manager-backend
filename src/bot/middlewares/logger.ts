// src/middlewares/logger.ts
import { Middleware } from 'grammy';
import createDebug from 'debug';
import BotMessage from '../../models/botMessage';
import { MyContext } from '../types';

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
      console.log('messageContent-photo: ', (await ctx.getFile()).file_path);
    } catch (err) {
      console.error('获取文件路径失败:', err);
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

  await BotMessage.create({
    bot: ctx.currentBot._id,
    botUser: ctx.currentBotUser._id,
    group: ctx.currentGroup?._id,
    content: messageContent,
    messageType,
  });

  const timestamp = new Date().toLocaleString('zh-CN');

  debug(
    `用户 ${
      ctx.from?.username || ctx.from?.id
    } 在 ${timestamp} 发来了 ${messageType} 类型消息: ${messageContent}`,
  );
  await next();
};

export default logger;
