import { Middleware } from 'grammy';
import { MyContext } from '../types';
import ServiceMessage, { IServiceMessage } from '../../models/serviceMessage';
import { getCache } from '../../utils/cache';
import createDebug from 'debug';

const debug = createDebug('bot:service-message-deleter');

/**
 * 服务消息删除中间件
 *
 * 策略：立即发起单独的 deleteMessage 请求，不批量、不延迟
 * - throttler 插件会自动排队和限流，确保不触发 Telegram 的 429
 * - autoRetry 插件会处理偶发的限流错误
 * - 这种方式删除速度最快，因为 throttler 会自动调整到最大允许速率
 */
export const serviceMessageDeleter: Middleware<MyContext> = async (
  ctx,
  next,
) => {
  if (!ctx.message || !ctx.currentGroup || !ctx.currentBot) {
    debug(
      `跳过: message=${!!ctx.message}, currentGroup=${!!ctx.currentGroup}, currentBot=${!!ctx.currentBot}`,
    );
    return await next();
  }

  const msg = ctx.message;

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

  if (!hasServiceMessage) {
    return await next();
  }

  try {
    const cacheKey = `serviceMsg:${ctx.currentBot._id}:${ctx.currentGroup._id}`;
    const cache = getCache();

    let config = await cache.get<IServiceMessage>(cacheKey);

    if (!config) {
      config = await ServiceMessage.findOne({
        bot: ctx.currentBot._id,
        group: ctx.currentGroup._id,
        isActive: true,
      });

      debug(`数据库查询配置: found=${!!config}`);

      if (config) {
        await cache.set(cacheKey, config, 300000);
      } else {
        await cache.set(cacheKey, null, 60000);
      }
    } else {
      debug(`缓存命中: ${cacheKey}`);
    }

    if (!config) {
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
      const chatId = ctx.chat!.id;
      const messageId = msg.message_id;
      const api = ctx.api;

      if (config.deleteDelay && config.deleteDelay > 0) {
        // 延迟删除：使用 setTimeout
        debug(
          `⏰ 延迟 ${config.deleteDelay}s 删除 [${messageType}] ${messageId}`,
        );
        setTimeout(async () => {
          try {
            await api.deleteMessage(chatId, messageId);
            debug(`✅ 延迟删除成功 [${messageType}] ${messageId}`);
          } catch (e: any) {
            debug(`❌ 延迟删除失败 [${messageType}]: ${e.message}`);
          }
        }, config.deleteDelay * 1000);
      } else {
        // 立即删除：fire-and-forget，throttler 会自动排队限流
        debug(`� 立即删除 [${messageType}] ${messageId}`);
        api.deleteMessage(chatId, messageId).catch((e: any) => {
          debug(`❌ 删除失败 [${messageType}] ${messageId}: ${e.message}`);
        });
      }
    }
  } catch (error) {
    debug('服务消息删除中间件出错:', error);
  }

  await next();
};
