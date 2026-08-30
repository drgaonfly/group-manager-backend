import { Middleware } from 'grammy';
import { MyContext } from '../types';
import createDebug from 'debug';

const debug = createDebug('bot:service-message-deleter');

/**
 * 服务消息删除中间件
 *
 * - new_chat_members：fire-and-forget 直接删，不阻塞中间件链
 * - 其余服务消息：直接删
 */
export const serviceMessageDeleter: Middleware<MyContext> = async (
  ctx,
  next,
) => {
  if (!ctx.message || !ctx.currentBot) {
    return await next();
  }

  const msg = ctx.message;
  const chatId = ctx.chat!.id;
  const messageId = msg.message_id;

  // 入群消息：fire-and-forget 直接删，不阻塞中间件链

  // 其余服务消息：直接删（成员变动暂时停用）
  const isServiceMessage =
    msg.new_chat_members ||
    msg.left_chat_member || // 暂时停用
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

  if (isServiceMessage) {
    ctx.api.deleteMessage(chatId, messageId).catch((e) => {
      debug(`❌ 删除服务消息失败 ${messageId}: ${e.message}`);
    });
  }

  return await next();
};
