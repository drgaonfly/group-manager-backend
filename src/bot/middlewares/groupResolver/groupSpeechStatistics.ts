import { Middleware } from 'grammy';
import { MyContext } from '../../types';
import { PermissionChecker } from '../../utils/permissionChecker';
import BotMessage from '../../../models/botMessage';
import createDebug from 'debug';

const debug = createDebug('bot:groupSpeechStatistics');

/**
 * 群组发言统计中间件
 *
 * 功能：记录群组成员的发言消息到数据库，用于后续的统计和分析
 * 触发条件：
 * 1. 群组消息（非回调查询）
 * 2. 有权限使用发言统计功能
 * 3. 非对话状态（避免干扰对话流程）
 */
export const groupSpeechStatistics: Middleware<MyContext> = async (
  ctx,
  next,
) => {
  // 只处理群组消息，跳过回调查询
  if (ctx.callbackQuery || !ctx.message || !ctx.currentGroup) {
    return next();
  }

  try {
    // 检查是否有活跃对话（对话期间不记录发言统计）
    const activeConversations = await ctx.conversation.active();
    const hasActiveConversation = Object.keys(activeConversations).length > 0;

    if (hasActiveConversation) {
      debug('Active conversation detected, skipping speech statistics');
      return next();
    }

    // 检查权限
    const canUseSpeechStatic = PermissionChecker.canUseSpeechStatic(
      ctx.currentProxyUser,
      ctx.currentBot,
    );

    if (!canUseSpeechStatic) {
      return next();
    }

    const message = ctx.message;

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
    const mediaTypeEntry = Object.entries(mediaTypes).find(([_, id]) => id);
    const mediaType = mediaTypeEntry?.[0];

    const messageType = mediaType ?? 'text';

    const messageContent = message.text ?? '';

    // 异步创建消息记录，不阻塞消息流程
    BotMessage.create({
      bot: ctx.currentBot._id,
      botUser: ctx.currentBotUser._id,
      group: ctx.currentGroup._id,
      content: messageContent,
      messageType,
      caption: message?.caption,
      telegramMessageId: message.message_id,
      proxyUser: ctx.currentProxyUser?._id,
      isOwnerReply: false,
      raw: message,
    }).catch((err) => {
      debug('Failed to create BotMessage:', err);
    });
  } catch (err) {
    debug('Error in groupSpeechStatistics middleware:', err);
  }

  await next();
};
