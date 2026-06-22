import { Middleware } from 'grammy';
import BotUser from '../../models/botUser';
import BotMessage from '../../models/botMessage';
import { findBotProxy } from '../services/findBotProxy';
import { formatBeijingDate } from '../../utils/formatBeijingDate';
import { MyContext } from '../types';
import { setupBot } from '../botSetup';
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

  const owners = await BotUser.find({
    _id: { $in: ctx.currentBot.owners || [] },
  });

  // 获取代理用户权限
  const { proxyUser } = await findBotProxy(ctx.currentBot);

  // 自己是拥有者的话，不要发给自己
  const processed_owners = owners.filter(
    (owner) => owner.id !== ctx.currentBotUser.id,
  );

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

      // 发言统计功能开启且是群组消息时，单独记录消息（不触发转发通知）
      if (canUseSpeechStatic && ctx.currentGroup && !canUseGroupMessaging) {
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

        // 即时发言奖励（fire-and-forget，不阻塞消息处理）
        tryGrantSpeechReward(
          ctx.currentBot._id,
          ctx.currentBotUser._id,
          ctx.currentGroup?._id,
        ).catch((err) => console.error('[speechReward] 即时奖励失败:', err));
      }

      // 群发功能可用，给所有 owner 发送通知
      if (canUseGroupMessaging) {
        // 创建消息记录（已包含发言统计所需数据）
        await BotMessage.create({
          bot: ctx.currentBot._id,
          botUser: ctx.currentBotUser._id,
          group: ctx.currentGroup?._id,
          content: fileId || message.text || messageContent,
          messageType,
          caption: message?.caption,
          telegramMessageId: message.message_id, // 电报消息 ID
          proxyUser: proxyUser?._id, // 代理用户
          isOwnerReply: false, // 客户消息，不是拥有者回复
          raw: message, // 原始消息体
        });

        // 即时发言奖励（群组消息时触发）
        if (canUseSpeechStatic && ctx.currentGroup) {
          tryGrantSpeechReward(
            ctx.currentBot._id,
            ctx.currentBotUser._id,
            ctx.currentGroup._id,
          ).catch((err) => console.error('[speechReward] 即时奖励失败:', err));
        }

        try {
          const bot = setupBot(ctx.currentBot.token);

          // 循环所有 owner.id 发送
          for (const owner of processed_owners) {
            if (owner?.id) {
              try {
                // 直接转发原始消息,用forwardMessage方法
                await bot.api.forwardMessage(
                  owner.id,
                  ctx.chat.id,
                  ctx.message.message_id,
                );
              } catch (forwardErr: any) {
                // 如果转发失败（比如用户还没有和机器人开始对话），尝试使用 sendMessage 发送消息内容
                console.error(
                  `转发消息给拥有者 ${owner.id} 失败，尝试其他方式:`,
                  forwardErr.message || forwardErr.description,
                );

                try {
                  // 获取发送者信息
                  const senderInfo = `👤 来自用户: ${
                    ctx.currentBotUser.firstName || ''
                  } ${ctx.currentBotUser.lastName || ''}${
                    ctx.currentBotUser.userName
                      ? ` (@${ctx.currentBotUser.userName})`
                      : ''
                  }\nID: ${ctx.currentBotUser.id}\n\n`;

                  // 尝试发送消息建立对话
                  if (message?.text) {
                    // 文本消息：发送包含发送者信息和消息内容
                    await bot.api.sendMessage(
                      owner.id,
                      senderInfo + message.text,
                    );
                  } else {
                    // 媒体消息：先尝试发送一条提示消息
                    const notifyMsg = `${senderInfo}[媒体消息]`;
                    await bot.api.sendMessage(owner.id, notifyMsg);

                    // 然后尝试复制媒体消息
                    try {
                      await bot.api.copyMessage(
                        owner.id,
                        ctx.chat.id,
                        ctx.message.message_id,
                      );
                    } catch (copyErr) {
                      console.error(
                        `复制媒体消息给拥有者 ${owner.id} 失败:`,
                        copyErr,
                      );
                    }
                  }
                } catch (sendErr: any) {
                  // 如果所有方式都失败，说明用户确实还没有和机器人开始对话
                  // 记录错误但不中断流程
                  console.error(
                    `无法发送消息给拥有者 ${owner.id}，用户可能还没有和机器人开始对话:`,
                    sendErr.message || sendErr.description,
                  );
                }
              }
            }
          }
        } catch (err) {
          console.error('发送通知失败:', err);
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
