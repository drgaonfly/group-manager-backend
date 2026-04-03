// src/middlewares/logger.ts
import { Middleware } from 'grammy';
import BotUser from '../../models/botUser';
import BotMessage from '../../models/botMessage';
import { findBotProxy } from '../services/findBotProxy';
import { formatBeijingDate } from '../../utils/formatBeijingDate';
import { MyContext } from '../types';
import { setupBot } from '../botSetup';
import { PermissionChecker } from '../utils/permissionChecker';
import Evaluation from '../../models/evaluation';
import {
  searchTeachers,
  getTeacherEvaluationsText,
} from '../../services/teacherService';

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

  // 检查当前用户是否是拥有者
  const isOwner = owners.some((owner) => owner.id === ctx.currentBotUser.id);

  // 获取代理用户权限
  const { proxyUser } = await findBotProxy(ctx.currentBot);

  // 如果是拥有者回复消息，且双向功能可用，则转发给原始用户，同时也发送给其他拥有者
  if (
    isOwner &&
    message?.reply_to_message &&
    PermissionChecker.canUseBidirectional(proxyUser, ctx.currentBot)
  ) {
    try {
      console.log('=== 拥有者回复检测 ===');
      console.log('回复的消息:', message.reply_to_message);

      const replyMsg = message.reply_to_message as any;
      let originalUserId: number | undefined;

      // 检查回复的消息是否是转发的消息
      if (replyMsg.forward_from || replyMsg.forward_from_chat) {
        originalUserId = replyMsg.forward_from?.id;

        if (originalUserId) {
          const bot = setupBot(ctx.currentBot.token);

          // 获取被回复的客户 BotUser
          let originalBotUser: any = null;
          try {
            originalBotUser = await BotUser.findOne({
              id: originalUserId.toString(),
              bot: ctx.currentBot._id,
            });
          } catch (err) {
            console.error('获取原始用户信息失败:', err);
          }

          // 检测消息类型和内容
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
          const mediaType = Object.entries(mediaTypes).find(
            ([_, id]) => id,
          )?.[0];
          const fileId = mediaType ? mediaTypes[mediaType] : null;
          const ownerReplyMessageType = mediaType || messageType;
          const ownerReplyContent = fileId || message?.text || messageContent;

          try {
            // 将拥有者的回复复制给原始用户
            await bot.api.copyMessage(
              originalUserId,
              ctx.chat.id,
              message.message_id,
            );

            console.log(`✅ 已将拥有者的回复发送给用户: ${originalUserId}`);
          } catch (copyErr: any) {
            // 如果复制失败（比如用户还没有和机器人开始对话）
            if (
              copyErr.error_code === 400 &&
              copyErr.description?.includes('chat not found')
            ) {
              console.log(
                `用户 ${originalUserId} 还没有和机器人开始对话，无法发送回复`,
              );
              await ctx.reply('❌ 发送失败：用户还没有和机器人开始对话');
            } else {
              console.error('发送回复给用户失败:', copyErr);
              const errorMsg =
                copyErr?.message ||
                copyErr?.description ||
                copyErr?.toString() ||
                '未知错误';
              await ctx.reply(`❌ 发送失败：${errorMsg}`);
            }
          }

          // 保存拥有者回复的消息到数据库（关联到客户的 BotUser）
          // 即使 originalBotUser 不存在，也要尝试保存（使用当前拥有者作为 botUser）
          try {
            let targetBotUser = originalBotUser;

            // 如果找不到客户的 BotUser，使用拥有者的 BotUser（可能是拥有者在回复）
            if (!targetBotUser) {
              console.warn(
                `未找到客户 BotUser (ID: ${originalUserId})，使用拥有者 BotUser`,
              );
              targetBotUser = ctx.currentBotUser;
            }

            if (targetBotUser) {
              await BotMessage.create({
                bot: ctx.currentBot._id,
                botUser: targetBotUser._id, // 关联到客户或拥有者
                group: ctx.currentGroup?._id,
                content: ownerReplyContent,
                messageType: ownerReplyMessageType,
                caption: message?.caption,
                telegramMessageId: message.message_id, // 电报消息 ID
                proxyUser: proxyUser?._id, // 代理用户
                isOwnerReply: true, // 标记为拥有者回复
                raw: message, // 原始消息体
              });
              console.log(
                `✅ 已保存拥有者回复消息到数据库，关联到: ${
                  originalBotUser
                    ? `客户 (${originalUserId})`
                    : `拥有者 (${targetBotUser.id})`
                }`,
              );
            } else {
              console.error(
                `无法保存拥有者回复消息：找不到 BotUser (客户ID: ${originalUserId})`,
              );
            }
          } catch (saveErr: any) {
            console.error('保存拥有者回复消息失败:', saveErr);
            console.error('错误详情:', saveErr.message || saveErr);
          }

          // 将拥有者的回复也发送给其他拥有者
          const otherOwners = owners.filter(
            (owner) =>
              owner.id !== ctx.currentBotUser.id && owner.id !== originalUserId,
          );

          if (otherOwners.length > 0) {
            console.log(`📢 将回复同步给其他 ${otherOwners.length} 个拥有者`);

            // 获取回复的拥有者信息（当前发送消息的用户）
            const replyOwner = ctx.currentBotUser;
            let replyOwnerDisplayName = '';
            if (replyOwner) {
              const firstName = replyOwner.firstName || '';
              const lastName = replyOwner.lastName || '';
              const userName = replyOwner.userName || '';

              if (firstName || lastName) {
                replyOwnerDisplayName = `${firstName} ${lastName}`.trim();
              } else if (userName) {
                replyOwnerDisplayName = `@${userName}`;
              } else {
                replyOwnerDisplayName = `ID: ${replyOwner.id}`;
              }
            }

            // 获取被回复的客户信息（已在上面获取，这里不需要重复获取）

            // 构建客户显示名称：优先 firstName + lastName，没有才用 userName
            let customerDisplayName = '';
            if (originalBotUser) {
              const firstName = originalBotUser.firstName || '';
              const lastName = originalBotUser.lastName || '';
              const userName = originalBotUser.userName || '';

              if (firstName || lastName) {
                customerDisplayName = `${firstName} ${lastName}`.trim();
              } else if (userName) {
                customerDisplayName = `@${userName}`;
              } else {
                customerDisplayName = `ID: ${originalUserId}`;
              }
            } else {
              customerDisplayName = `ID: ${originalUserId}`;
            }

            for (const otherOwner of otherOwners) {
              if (otherOwner?.id) {
                try {
                  // 使用 forwardMessage 转发两条消息，都使用 forward
                  // 第一条：转发客户的原始消息（显示客户信息）
                  try {
                    await bot.api.forwardMessage(
                      otherOwner.id,
                      ctx.chat.id,
                      replyMsg.message_id,
                    );
                    console.log(`✅ 已转发客户消息给拥有者 ${otherOwner.id}`);
                  } catch (forwardCustomerErr: any) {
                    // 如果转发客户消息失败，记录但不中断
                    console.error(
                      `转发客户消息给拥有者 ${otherOwner.id} 失败:`,
                      forwardCustomerErr.message ||
                        forwardCustomerErr.description,
                    );
                  }

                  // 第二条：转发拥有者的回复（forward_from 会自动显示回复的拥有者信息）
                  try {
                    await bot.api.forwardMessage(
                      otherOwner.id,
                      ctx.chat.id,
                      message.message_id,
                    );
                    console.log(
                      `✅ 已转发拥有者回复给拥有者 ${otherOwner.id} (回复者: ${replyOwnerDisplayName})`,
                    );
                  } catch (forwardReplyErr: any) {
                    // 如果转发失败，尝试复制消息并发送提示信息
                    console.error(
                      `转发拥有者回复给拥有者 ${otherOwner.id} 失败，尝试复制:`,
                      forwardReplyErr.message || forwardReplyErr.description,
                    );

                    // 先发送提示信息：哪个拥有者回复了哪个客户
                    const syncMessage = `💬 拥有者回复客户\n\n回复者: ${replyOwnerDisplayName}\n客户: ${customerDisplayName}\n回复内容:\n\n`;

                    let infoMsg: any = null;
                    try {
                      infoMsg = await bot.api.sendMessage(
                        otherOwner.id,
                        syncMessage,
                      );
                    } catch (sendErr: any) {
                      console.error(
                        `发送提示信息给拥有者 ${otherOwner.id} 失败:`,
                        sendErr.message || sendErr.description,
                      );
                    }

                    // 然后复制消息
                    try {
                      await bot.api.copyMessage(
                        otherOwner.id,
                        ctx.chat.id,
                        message.message_id,
                        infoMsg
                          ? { reply_to_message_id: infoMsg.message_id }
                          : undefined,
                      );
                      console.log(
                        `✅ 已复制拥有者回复给拥有者 ${otherOwner.id}`,
                      );
                    } catch (copyErr) {
                      console.error(
                        `复制拥有者回复给拥有者 ${otherOwner.id} 也失败:`,
                        copyErr,
                      );
                    }
                  }
                } catch (syncErr: any) {
                  // 如果同步失败，记录错误但不中断流程
                  console.error(
                    `同步回复给拥有者 ${otherOwner.id} 失败:`,
                    syncErr.message || syncErr.description,
                  );
                }
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error('转发拥有者回复失败:', err);
      const errorMsg =
        err?.message || err?.description || err?.toString() || '未知错误';
      await ctx.reply(`❌ 发送失败：${errorMsg}`);
    }

    // 拥有者的回复不需要继续处理
    await next();
    return;
  }

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

      // 群发功能可用，给所有 owner 发送通知
      if (PermissionChecker.canUseGroupMessaging(proxyUser, ctx.currentBot)) {
        // 创建消息记录
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

  // 如果消息是文本，尝试查找老师
  if (
    message?.text &&
    !isOwner &&
    PermissionChecker.canUseTeaching(proxyUser, ctx.currentBot)
  ) {
    const text = message.text.trim();
    // 简单正则判断是否可能是老师姓名（这里可以根据需求调整逻辑）
    // 比如：如果消息长度适中且不包含特殊指令前缀
    if (text.length >= 2 && text.length <= 30 && !text.startsWith('/')) {
      try {
        // 1. 如果是 @username 格式，先尝试直接匹配老师并显示其评价
        if (text.startsWith('@')) {
          const userName = text.slice(1);
          const { teachers } = await searchTeachers(
            userName,
            ctx.currentBot._id,
          );
          if (teachers.length > 0) {
            const teacher = teachers[0];
            const evalText = await getTeacherEvaluationsText(
              teacher._id,
              ctx.currentBot.userName,
            );
            if (evalText) {
              await ctx.reply(evalText, {
                parse_mode: 'Markdown',
                reply_to_message_id: message.message_id,
                link_preview_options: { is_disabled: true },
              });
              await next();
              return;
            }
          }
        }

        // 2. 普通搜索逻辑
        const { teachers, message: teacherMsg } = await searchTeachers(
          text,
          ctx.currentBot._id,
        );
        if (teachers.length > 0) {
          await ctx.reply(`💡 发现匹配的老师信息：\n\n${teacherMsg}`, {
            parse_mode: 'Markdown',
            reply_to_message_id: message.message_id,
          });
        }
      } catch (err) {
        console.error('Logger teacher lookup failed:', err);
      }
    }
  }

  await next();
};

export default logger;
