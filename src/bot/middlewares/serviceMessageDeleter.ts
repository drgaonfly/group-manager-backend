import { Middleware } from 'grammy';
import { MyContext } from '../types';
import { redis } from '../../utils/redis';
import createDebug from 'debug';

const debug = createDebug('bot:service-message-deleter');

/** Redis List key，定时任务从这里消费 */
export const SVC_DEL_QUEUE_KEY = 'svc:del:join:queue';

/**
 * 服务消息删除中间件
 *
 * - new_chat_members：写入 Redis List，由定时任务批量删除
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
  const botToken = ctx.currentBot.token;

  // 入群消息：高频，存 Redis 由定时任务批量删
  if (msg.new_chat_members) {
    if (redis) {
      await redis.rpush(
        SVC_DEL_QUEUE_KEY,
        JSON.stringify({ token: botToken, chatId, messageId }),
      );
      debug(`📥 入群消息入队 chatId=${chatId} messageId=${messageId}`);
    } else {
      debug('⚠️ Redis 不可用，降级直接删入群消息');
      ctx.api.deleteMessage(chatId, messageId).catch((e) => {
        debug(`❌ 降级删除失败 ${messageId}: ${e.message}`);
      });
    }
    return await next();
  }

  // 其余服务消息：直接删
  const isServiceMessage =
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

  if (isServiceMessage) {
    ctx.api.deleteMessage(chatId, messageId).catch((e) => {
      debug(`❌ 删除服务消息失败 ${messageId}: ${e.message}`);
    });
  }

  return await next();
};
