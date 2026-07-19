import { Middleware } from 'grammy';
import { formatBeijingDate } from '../../utils/formatBeijingDate';
import { MyContext } from '../types';

import createDebug from 'debug';
const debug = createDebug('bot:logger');

/**
 * 日志中间件
 *
 * 功能：记录消息类型和内容，用于调试和监控
 */
const logger: Middleware = async (ctx: MyContext, next) => {
  const message = ctx.message;

  if (!message) {
    await next();
    return;
  }

  debug('Processing message');

  // 检查消息类型的配置
  const mediaTypes = {
    photo: { check: message?.photo, label: '[图片]' },
    video: { check: message?.video, label: '[视频]' },
    document: { check: message?.document, label: '[文档]' },
    animation: { check: message?.animation, label: '[动画]' },
    voice: { check: message?.voice, label: '[语音]' },
    audio: { check: message?.audio, label: '[音频]' },
    sticker: { check: message?.sticker, label: '[贴纸]' },
    video_note: { check: message?.video_note, label: '[视频笔记]' },
    location: { check: message?.location, label: '[位置]' },
  };

  // 查找匹配的消息类型
  let messageType = 'text';
  let messageContent = message?.text || '';

  // 检查多媒体类型
  const mediaType = Object.entries(mediaTypes).find(
    ([_, type]) => type.check,
  )?.[0];

  if (mediaType) {
    messageType = mediaType;
    messageContent = mediaTypes[mediaType].label;
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
    debug(`${messageContent} (提及用户: ${mentions})`);
  }

  debug(
    `用户 ${ctx.from?.username || ctx.from?.id} 在 ${formatBeijingDate(
      new Date(),
    )} 发来了 ${messageType} 类型消息: ${messageContent}`,
  );

  await next();
};

export default logger;
