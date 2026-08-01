import Bull from 'bull';
import { redis } from '../../../utils/redis';
import { AGGREGATE_WINDOW_MS } from './immediateDelete';
import createDebug from 'debug';

const debug = createDebug('bot:service-message-deleter:delayed');

/**
 * 延迟删除：写入 Redis List 缓冲（TTL = delayMs + 10s），通过 Bull delayed job 执行
 *
 * 与立即删除的区别：
 * - buffer TTL 需覆盖整个延迟时间，不能用短窗口
 * - bufferKey 带 timeSlot，保证不同时间槽的消息互相隔离
 * - lock TTL = delayMs + 15s，确保 Job 执行后锁自然过期
 *
 * 替代 setTimeout：持久化到 Redis，支持多实例，进程重启不丢任务
 */
export async function enqueueDelayed(
  queue: Bull.Queue,
  chatId: number,
  messageId: number,
  messageType: string,
  botToken: string,
  delayMs: number,
): Promise<void> {
  const timeSlot = Math.floor(Date.now() / AGGREGATE_WINDOW_MS);
  const bufferKey = `del-buf-delay:${chatId}:${delayMs}:${timeSlot}`;
  const lockKey = `del-lock-delay:${chatId}:${delayMs}:${timeSlot}`;

  // 写入缓冲，TTL = delayMs + 10s，确保 Job 触发时 buffer 仍然存在
  await redis!.rpush(bufferKey, JSON.stringify({ messageId, messageType }));
  await redis!.pexpire(bufferKey, delayMs + 10000);

  // SET NX：同一 chatId + delayMs + 时间槽内只创建一个 Job
  const acquired = await redis!.set(lockKey, '1', 'PX', delayMs + 15000, 'NX');

  if (acquired === 'OK') {
    const jobId = `del-delay:${chatId}:${delayMs}:${timeSlot}`;
    await queue.add(
      { chatId, messageIds: [], messageTypes: [], botToken, useBuffer: true },
      { jobId, delay: delayMs },
    );
    debug(`⏰ 延迟 Job 入队 jobId=${jobId}, delay=${delayMs}ms`);
  } else {
    debug(`ℹ️ 锁命中，跳过创建 chatId=${chatId}, delayMs=${delayMs}`);
  }
}
