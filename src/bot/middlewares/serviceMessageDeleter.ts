import { Middleware } from 'grammy';
import { MyContext } from '../types';
import ServiceMessage from '../../models/serviceMessage';
import createDebug from 'debug';

const debug = createDebug('bot:service-message-deleter');

/**
 * 服务消息删除中间件
 *
 * 根据群组的 ServiceMessage 配置，按开关决定是否删除对应类型的服务消息。
 * 未配置或 isActive=false 时不做任何处理。
 * deleteDelay > 0 时延迟删除。
 */
export const serviceMessageDeleter: Middleware<MyContext> = async (
  ctx,
  next,
) => {
  if (!ctx.message || !ctx.currentGroup || !ctx.currentBot) {
    return await next();
  }

  const msg = ctx.message;
  const chatId = ctx.chat!.id;
  const messageId = msg.message_id;

  // 查询该群组的服务消息配置
  const config = await ServiceMessage.findOne({
    bot: ctx.currentBot._id,
    group: ctx.currentGroup._id,
    isActive: true,
  }).lean();

  if (!config) {
    return await next();
  }

  // 判断当前消息是否需要删除
  const shouldDelete =
    (config.isJoinGroupDeleted && !!msg.new_chat_members) ||
    (config.isLeftGroupDeleted && !!msg.left_chat_member) ||
    (config.isNewTitleDeleted && !!msg.new_chat_title) ||
    (config.isNewPhotoDeleted && !!msg.new_chat_photo) ||
    (config.isDeletePhotoDeleted && !!msg.delete_chat_photo) ||
    (config.isPinnedMessageDeleted && !!msg.pinned_message) ||
    (config.isForumTopicCreatedDeleted && !!msg.forum_topic_created) ||
    (config.isForumTopicEditedDeleted && !!msg.forum_topic_edited) ||
    (config.isForumTopicClosedDeleted && !!msg.forum_topic_closed) ||
    (config.isForumTopicReopenedDeleted && !!msg.forum_topic_reopened) ||
    (config.isGeneralTopicHiddenDeleted && !!msg.general_forum_topic_hidden) ||
    (config.isGeneralTopicUnhiddenDeleted &&
      !!msg.general_forum_topic_unhidden) ||
    (config.isBoostAddedDeleted && !!msg.boost_added) ||
    (config.isVideoChatStartedDeleted && !!msg.video_chat_started) ||
    (config.isVideoChatEndedDeleted && !!msg.video_chat_ended) ||
    (config.isVideoChatScheduledDeleted && !!msg.video_chat_scheduled) ||
    (config.isVideoChatInvitedDeleted &&
      !!msg.video_chat_participants_invited) ||
    (config.isWriteAccessAllowedDeleted && !!msg.write_access_allowed) ||
    (config.isMigrateDeleted &&
      (!!msg.migrate_to_chat_id || !!msg.migrate_from_chat_id));

  if (!shouldDelete) {
    return await next();
  }

  const delay = config.deleteDelay ?? 0;

  const doDelete = () => {
    ctx.api.deleteMessage(chatId, messageId).catch((e) => {
      debug(`❌ 删除服务消息失败 ${messageId}: ${e.message}`);
    });
  };

  if (delay > 0) {
    setTimeout(doDelete, delay * 1000);
  } else {
    doDelete();
  }

  return await next();
};
