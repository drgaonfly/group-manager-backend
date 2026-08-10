import Bull from 'bull';
import { redis } from '../../../utils/redis';
import createDebug from 'debug';

const debug = createDebug('bot:service-message-deleter:immediate');

const AGGREGATE_WINDOW_MS = 2000; // 聚合窗口：2s 内同一 chatId 的消息合并（刷粉场景下消息密集，窗口拉大可显著减少 Job 数量）

/**
 * 立即删除：写入 Redis List 缓冲，同一时间槽内只创建一个 Bull Job
 *
 * 流程：
 * 1. rpush 消息到 del-buf:{chatId}:{timeSlot}
 * 2. SET NX del-lock:{chatId}:{timeSlot} — 只有第一条消息创建 Job
 * 3. Job delay = AGGREGATE_WINDOW_MS，确保窗口内所有消息都已写入缓冲
 *
 * 效果：1000 人入群 ≈ 200 条服务消息 → 2-4 个 Job → 2-4 次 deleteMessages API
 */
export async function enqueueImmediate(
  queue: Bull.Queue,
  chatId: number,
  messageId: number,
  messageType: string,
  botToken: string,
): Promise<void> {
  const timeSlot = Math.floor(Date.now() / AGGREGATE_WINDOW_MS);
  const bufferKey = `del-buf:${chatId}:${timeSlot}`;
  const lockKey = `del-lock:${chatId}:${timeSlot}`;

  // 写入缓冲，TTL = 聚合窗口 + 5s 余量
  await redis!.rpush(bufferKey, JSON.stringify({ messageId, messageType }));
  await redis!.pexpire(bufferKey, AGGREGATE_WINDOW_MS + 5000);

  // SET NX：同一时间槽只有第一个请求创建 Job，其余直接跳过
  const acquired = await redis!.set(
    lockKey,
    '1',
    'PX',
    AGGREGATE_WINDOW_MS + 5000,
    'NX',
  );

  if (acquired === 'OK') {
    const jobId = `del:${chatId}:${timeSlot}`;
    await queue.add(
      { chatId, messageIds: [], messageTypes: [], botToken, useBuffer: true },
      { jobId, delay: AGGREGATE_WINDOW_MS },
    );
    debug(`📝 立即删除 Job 入队 jobId=${jobId}, chatId=${chatId}`);
  } else {
    debug(`ℹ️ 锁命中，跳过创建 chatId=${chatId}, slot=${timeSlot}`);
  }
}

export { AGGREGATE_WINDOW_MS };
