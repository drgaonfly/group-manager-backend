import { Middleware, GrammyError } from 'grammy';
import { MyContext } from '../types';
import ServiceMessage, { IServiceMessage } from '../../models/serviceMessage';
import { getCache } from '../../utils/cache';
import createDebug from 'debug';

const debug = createDebug('bot:service-message-deleter');

/**
 * 服务消息删除中间件
 * 根据配置自动删除指定类型的服务消息
 */
export const serviceMessageDeleter: Middleware<MyContext> = async (
  ctx,
  next,
) => {
  // 只处理群组/超级群组中的消息
  if (!ctx.message || !ctx.currentGroup || !ctx.currentBot) {
    debug(
      `跳过: message=${!!ctx.message}, currentGroup=${!!ctx.currentGroup}, currentBot=${!!ctx.currentBot}`,
    );
    return await next();
  }

  const msg = ctx.message;

  // 只处理服务消息
  const hasServiceMessage =
    msg.new_chat_members ||
    msg.left_chat_member ||
    msg.new_chat_title ||
    msg.new_chat_photo ||
    msg.delete_chat_photo ||
    msg.pinned_message ||
    msg.forum_topic_created ||
    msg.forum_topic_edited ||
    msg.forum_topic_closed ||
    msg.forum_topic_reopened ||
    msg.general_forum_topic_hidden ||
    msg.general_forum_topic_unhidden ||
    msg.boost_added ||
    msg.video_chat_started ||
    msg.video_chat_ended ||
    msg.video_chat_scheduled ||
    msg.video_chat_participants_invited ||
    msg.write_access_allowed ||
    msg.migrate_to_chat_id ||
    msg.migrate_from_chat_id;

  debug(
    `hasServiceMessage=${!!hasServiceMessage}, msg keys with service: new_chat_photo=${!!msg.new_chat_photo}`,
  );

  if (!hasServiceMessage) {
    return await next();
  }

  try {
    // 使用缓存键：serviceMsg:{botId}:{groupId}
    const cacheKey = `serviceMsg:${ctx.currentBot._id}:${ctx.currentGroup._id}`;
    const cache = getCache();

    // 尝试从缓存获取配置
    let config = await cache.get<IServiceMessage>(cacheKey);

    if (!config) {
      // 缓存未命中，从数据库查询
      config = await ServiceMessage.findOne({
        bot: ctx.currentBot._id,
        group: ctx.currentGroup._id,
        isActive: true,
      });

      debug(
        `数据库查询配置: bot=${ctx.currentBot._id}, group=${
          ctx.currentGroup._id
        }, found=${!!config}`,
      );

      if (config) {
        // 存入缓存，TTL 5分钟
        await cache.set(cacheKey, config, 300000);
      } else {
        // 即使没有配置也缓存（避免缓存穿透），TTL 1分钟
        await cache.set(cacheKey, null, 60000);
      }
    } else {
      debug(`缓存命中: ${cacheKey}`);
    }

    if (!config) {
      debug('未找到服务消息配置，跳过');
      return await next();
    }

    let shouldDelete = false;
    let messageType = '';

    if (msg.new_chat_members && config.isJoinGroupDeleted) {
      shouldDelete = true;
      messageType = '新成员加入';
    } else if (msg.left_chat_member && config.isLeftGroupDeleted) {
      shouldDelete = true;
      messageType = '成员离开';
    } else if (msg.new_chat_title && config.isNewTitleDeleted) {
      shouldDelete = true;
      messageType = '修改群组标题';
    } else if (msg.new_chat_photo && config.isNewPhotoDeleted) {
      shouldDelete = true;
      messageType = '修改群组头像';
    } else if (msg.delete_chat_photo && config.isDeletePhotoDeleted) {
      shouldDelete = true;
      messageType = '删除群组头像';
    } else if (msg.pinned_message && config.isPinnedMessageDeleted) {
      shouldDelete = true;
      messageType = '置顶消息';
    } else if (msg.forum_topic_created && config.isForumTopicCreatedDeleted) {
      shouldDelete = true;
      messageType = '创建话题';
    } else if (msg.forum_topic_edited && config.isForumTopicEditedDeleted) {
      shouldDelete = true;
      messageType = '编辑话题';
    } else if (msg.forum_topic_closed && config.isForumTopicClosedDeleted) {
      shouldDelete = true;
      messageType = '关闭话题';
    } else if (msg.forum_topic_reopened && config.isForumTopicReopenedDeleted) {
      shouldDelete = true;
      messageType = '重新打开话题';
    } else if (
      msg.general_forum_topic_hidden &&
      config.isGeneralTopicHiddenDeleted
    ) {
      shouldDelete = true;
      messageType = '隐藏通用话题';
    } else if (
      msg.general_forum_topic_unhidden &&
      config.isGeneralTopicUnhiddenDeleted
    ) {
      shouldDelete = true;
      messageType = '显示通用话题';
    } else if (msg.boost_added && config.isBoostAddedDeleted) {
      shouldDelete = true;
      messageType = '用户助推';
    } else if (msg.video_chat_started && config.isVideoChatStartedDeleted) {
      shouldDelete = true;
      messageType = '视频聊天开始';
    } else if (msg.video_chat_ended && config.isVideoChatEndedDeleted) {
      shouldDelete = true;
      messageType = '视频聊天结束';
    } else if (msg.video_chat_scheduled && config.isVideoChatScheduledDeleted) {
      shouldDelete = true;
      messageType = '视频聊天计划';
    } else if (
      msg.video_chat_participants_invited &&
      config.isVideoChatInvitedDeleted
    ) {
      shouldDelete = true;
      messageType = '邀请参与视频聊天';
    } else if (msg.write_access_allowed && config.isWriteAccessAllowedDeleted) {
      shouldDelete = true;
      messageType = '写入权限授予';
    } else if (
      (msg.migrate_to_chat_id || msg.migrate_from_chat_id) &&
      config.isMigrateDeleted
    ) {
      shouldDelete = true;
      messageType = '群组升级';
    }

    if (shouldDelete) {
      // 提前捕获所有需要的值，避免延迟后 ctx 失效
      const chatId = ctx.chat!.id;
      const messageId = msg.message_id;
      const groupTitle = ctx.currentGroup.title;
      const api = ctx.api;

      const deleteMessage = async () => {
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            await api.deleteMessage(chatId, messageId);
            debug(
              `✅ 已删除服务消息 [${messageType}]: ${messageId} (群组: ${groupTitle})`,
            );
            return;
          } catch (e: any) {
            // 处理 Telegram 限流（RetryAfter）
            if (e instanceof GrammyError && e.error_code === 429) {
              const retryAfter = (e.parameters?.retry_after ?? 5) as number;
              debug(
                `⚠️ 触发限流 [${messageType}] 第${attempt}次, ${retryAfter}秒后重试`,
              );
              if (attempt < maxRetries) {
                await new Promise((r) =>
                  setTimeout(r, (retryAfter + 1) * 1000),
                );
                continue;
              }
            }
            debug(
              `❌ 删除服务消息失败 [${messageType}] 第${attempt}次: ${e.message}`,
            );
            // 非限流错误或已达最大重试次数，不再重试
            return;
          }
        }
      };

      if (config.deleteDelay && config.deleteDelay > 0) {
        debug(
          `⏰ 将在 ${config.deleteDelay} 秒后删除服务消息 [${messageType}]`,
        );
        setTimeout(deleteMessage, config.deleteDelay * 1000);
      } else {
        await deleteMessage();
      }
    }
  } catch (error) {
    debug('服务消息删除中间件出错:', error);
  }

  await next();
};
