import { Middleware } from 'grammy';
import BotMessage from '../../models/botMessage';
import { findBotProxy } from '../services/findBotProxy';
import { formatBeijingDate } from '../../utils/formatBeijingDate';
import { MyContext } from '../types';
import { PermissionChecker } from '../utils/permissionChecker';
import { tryGrantSpeechReward } from '../../services/speechRewardService';

import createDebug from 'debug';
const debug = createDebug('bot:replaceMentions');

// 定义一个日志中间件
const logger: Middleware = async (ctx: MyContext, next) => {
  debug('logger');
  const message = ctx.message;

  // 如果有活跃的对话（比如正在写评价），跳过 logger 的自动回复逻辑
  // 检查当前会话是否真的有活跃的对话运行
  const activeConversations = await ctx.conversation.active();
  const hasActiveConversation = Object.keys(activeConversations).length > 0;

  if (hasActiveConversation) {
    debug('Active conversation detected, skipping logger logic');
    await next();
    return;
  }

  debug(message);

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

  console.log('=== 消息类型检测开始 ===');

  // 检查多媒体类型
  const mediaType = Object.entries(mediaTypes).find(
    ([_, type]) => type.check,
  )?.[0];
  console.log('多媒体类型检测结果:', mediaType);

  if (mediaType) {
    messageType = mediaType;
    messageContent = mediaTypes[mediaType].label;
    console.log('确定为多媒体类型:', messageType);
  }

  console.log('=== 最终结果 ===');
  console.log('消息类型:', messageType);
  console.log('消息内容:', messageContent);

  debug('message: ', message);

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

  // 获取代理用户权限
  const { proxyUser } = await findBotProxy(ctx.currentBot);

  // 处理所有消息类型（非拥有者的消息）
  if (!ctx.callbackQuery && message) {
    try {
      // 统一处理所有消息类型
      const mediaTypes = {
        photo: message?.photo?.[message.photo.length - 1]?.file_id,
        video: message?.video?.file_id,
        document: message?.document?.file_id,
        animation: message?.animation?.file_id,
        voice: message?.voice?.file_id,
        audio: message?.audio?.file_id,
        sticker: message?.sticker?.file_id,
        video_note: message?.video_note?.file_id,
      };

      // 查找匹配的媒体类型
      const mediaType = Object.entries(mediaTypes).find(([_, id]) => id)?.[0];
      const fileId = mediaType ? mediaTypes[mediaType] : null;

      const canUseGroupMessaging = PermissionChecker.canUseGroupMessaging(
        proxyUser,
        ctx.currentBot,
      );
      const canUseSpeechStatic = PermissionChecker.canUseSpeechStatic(
        proxyUser,
        ctx.currentBot,
      );

      console.log(
        `[Logger] User Message - canUseGroupMessaging: ${canUseGroupMessaging}, canUseSpeechStatic: ${canUseSpeechStatic}`,
      );

      // 发言统计
      if (canUseSpeechStatic && ctx.currentGroup) {
        await BotMessage.create({
          bot: ctx.currentBot._id,
          botUser: ctx.currentBotUser._id,
          group: ctx.currentGroup._id,
          content: fileId || message.text || messageContent,
          messageType,
          caption: message?.caption,
          telegramMessageId: message.message_id,
          proxyUser: proxyUser?._id,
          isOwnerReply: false,
          raw: message,
        });

        tryGrantSpeechReward(
          ctx.currentBot._id,
          ctx.currentBotUser._id,
          ctx.currentGroup._id,
        ).catch((err) => console.error('[speechReward] 即时奖励失败:', err));
      }

      // 群发功能可用时，只记录消息（不再转发给 owner）
      if (canUseGroupMessaging) {
        await BotMessage.create({
          bot: ctx.currentBot._id,
          botUser: ctx.currentBotUser._id,
          group: ctx.currentGroup?._id,
          content: fileId || message.text || messageContent,
          messageType,
          caption: message?.caption,
          telegramMessageId: message.message_id,
          proxyUser: proxyUser?._id,
          isOwnerReply: false,
          raw: message,
        });

        if (canUseSpeechStatic && ctx.currentGroup) {
          tryGrantSpeechReward(
            ctx.currentBot._id,
            ctx.currentBotUser._id,
            ctx.currentGroup._id,
          ).catch((err) => console.error('[speechReward] 即时奖励失败:', err));
        }
      }
    } catch (err) {
      console.error('处理消息失败:', err);
    }
  }

  debug(
    `用户 ${ctx.from?.username || ctx.from?.id} 在 ${formatBeijingDate(
      new Date(),
    )} 发来了 ${messageType} 类型消息: ${messageContent}`,
  );

  await next();
};

export default logger;
