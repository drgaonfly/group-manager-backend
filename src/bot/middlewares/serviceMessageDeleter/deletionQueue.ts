import Bull from 'bull';
import { redis } from '../../../utils/redis';
import { enqueueImmediate } from './immediateDelete';
import { enqueueDelayed } from './delayedDelete';
import createDebug from 'debug';

const debug = createDebug('bot:service-message-deleter:queue');

const BATCH_SIZE = 100; // Telegram deleteMessages 单次上限

/**
 * 全局并发上限：允许最多 50 个 Job 同时跑（跨所有群）。
 *
 * 配合 Bull limiter 做全局速率限制，避免同时向 Telegram 发起太多请求。
 * 单群串行由 jobId 唯一性（SET NX 锁）保证：同一 chatId+slot 只有一个 Job，
 * 下一个窗口的 Job 入队时上一个已经执行完，因此同群天然不会并发。
 */
const PROCESS_CONCURRENCY = 50;

/**
 * Bull rate limiter：每秒最多处理 30 个 Job（跨所有群）。
 * 每个 Job 调用一次 deleteMessages（最多 100 条），30 req/s 远低于 Telegram 全局限制，
 * 大幅降低 429 概率，避免 autoRetry 长期 block 住 worker slot。
 */
const QUEUE_LIMITER: Bull.RateLimiter = {
  max: 30,
  duration: 1000, // ms
};

interface DeletionJob {
  chatId: number;
  messageIds: number[];
  messageTypes: string[];
  botToken: string;
  useBuffer: boolean;
}

/**
 * 服务消息删除队列
 *
 * 职责：
 * - 创建并持有 Bull Queue 实例
 * - 将 add() 调用分发给立即删除或延迟删除策略
 * - 注册 processor：从 Redis buffer 原子读取消息并批量删除
 */
export class DeletionQueue {
  private queue: Bull.Queue<DeletionJob>;

  constructor() {
    if (!redis) {
      throw new Error('Redis 未连接，无法创建删除队列');
    }

    this.queue = new Bull<DeletionJob>('service-msg-deletion', {
      redis: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
        db: Number(process.env.REDIS_DB),
      },
      limiter: QUEUE_LIMITER,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    });

    this.setupProcessor();
    this.setupEventListeners();

    debug('✅ 删除队列已初始化');
  }

  /**
   * 添加删除任务
   * @param delayMs 0 = 立即删除（聚合模式）；>0 = 延迟删除
   */
  async add(
    chatId: number,
    messageId: number,
    messageType: string,
    botToken: string,
    delayMs = 0,
  ): Promise<void> {
    if (delayMs > 0) {
      await enqueueDelayed(
        this.queue,
        chatId,
        messageId,
        messageType,
        botToken,
        delayMs,
      );
    } else {
      await enqueueImmediate(
        this.queue,
        chatId,
        messageId,
        messageType,
        botToken,
      );
    }
  }

  private setupProcessor(): void {
    this.queue.process(
      PROCESS_CONCURRENCY,
      async (job: Bull.Job<DeletionJob>) => {
        const { chatId, botToken, useBuffer } = job.data;
        let messageIds = job.data.messageIds;
        let messageTypes = job.data.messageTypes;

        if (useBuffer) {
          // jobId 命名规则：
          //   立即删除  → del:{chatId}:{slot}              → del-buf:{chatId}:{slot}
          //   延迟删除  → del-delay:{chatId}:{ms}:{slot}   → del-buf-delay:{chatId}:{ms}:{slot}
          const jobId = String(job.id);
          const bufferKey = jobId.startsWith('del-delay:')
            ? jobId.replace('del-delay:', 'del-buf-delay:')
            : jobId.replace('del:', 'del-buf:');

          // Lua 脚本原子读取并清空，防止多实例竞争
          const buffered = (await redis!.eval(
            `local d = redis.call('LRANGE', KEYS[1], 0, -1); redis.call('DEL', KEYS[1]); return d`,
            1,
            bufferKey,
          )) as string[];

          if (buffered.length > 0) {
            const parsed = buffered.map(
              (s) =>
                JSON.parse(s) as { messageId: number; messageType: string },
            );
            messageIds = parsed.map((p) => p.messageId);
            messageTypes = parsed.map((p) => p.messageType);
            debug(
              `📥 读取缓冲 chatId=${chatId}, count=${messageIds.length}, key=${bufferKey}`,
            );
          }
        }

        if (messageIds.length === 0) {
          debug(`⚠️ 空作业跳过 jobId=${job.id}`);
          return { success: true, deletedCount: 0 };
        }

        const { setupLightBot } = await import('../../botSetup');
        const bot = setupLightBot(botToken);

        // 将所有消息切成 BATCH_SIZE 大小的分片，并发执行，充分利用 Telegram 批量接口
        const batches: Array<{ ids: number[]; types: string[] }> = [];
        for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
          batches.push({
            ids: messageIds.slice(i, i + BATCH_SIZE),
            types: messageTypes.slice(i, i + BATCH_SIZE),
          });
        }

        const results = await Promise.allSettled(
          batches.map(async ({ ids, types }) => {
            try {
              if (ids.length === 1) {
                await bot.api.deleteMessage(chatId, ids[0]);
              } else {
                await bot.api.deleteMessages(chatId, ids);
              }
              debug(`✅ 删除 chatId=${chatId}, count=${ids.length}`);
              return ids.length;
            } catch (e: any) {
              if (e.description?.includes('method not found')) {
                // 旧版 Telegram，逐个回退
                debug('⚠️ deleteMessages 不支持，回退逐个删除');
                let count = 0;
                for (let j = 0; j < ids.length; j++) {
                  try {
                    await bot.api.deleteMessage(chatId, ids[j]);
                    count++;
                  } catch (err: any) {
                    debug(
                      `❌ 逐个删除失败 [${types[j]}] ${ids[j]}: ${err.message}`,
                    );
                  }
                }
                return count;
              } else if (
                e.description?.includes('message to delete not found') ||
                e.description?.includes("message can't be deleted")
              ) {
                debug(`⚠️ 消息不存在或无权限，跳过本批`);
                return ids.length; // 视为成功
              } else if (
                e.description?.includes('bot was kicked') ||
                e.description?.includes('bot is not a member') ||
                e.description?.includes('chat not found') ||
                e.error_code === 403 ||
                e.error_code === 400
              ) {
                debug(
                  `⚠️ bot 无法访问群 chatId=${chatId}，跳过 Job: ${e.description}`,
                );
                return 0; // 整个群放弃，不重试
              } else {
                throw e; // 交给 Bull 重试
              }
            }
          }),
        );

        let deletedCount = 0;
        let shouldRetry = false;

        for (const r of results) {
          if (r.status === 'fulfilled') {
            deletedCount += r.value;
          } else {
            // 有分片抛出了非预期错误，交给 Bull 重试整个 Job
            shouldRetry = true;
            debug(`💥 分片删除抛出异常: ${r.reason?.message}`);
          }
        }

        if (shouldRetry) {
          throw new Error('部分分片删除失败，触发 Bull 重试');
        }

        return { success: true, deletedCount };
      },
    );
  }

  private setupEventListeners(): void {
    this.queue.on('completed', (job: Bull.Job<DeletionJob>, result: any) => {
      debug(
        `✨ 完成 jobId=${job.id}, chatId=${job.data.chatId}, deleted=${result.deletedCount}`,
      );
    });

    this.queue.on(
      'failed',
      (job: Bull.Job<DeletionJob> | undefined, err: Error) => {
        if (job) {
          debug(
            `💥 失败 jobId=${job.id}, chatId=${job.data.chatId}, error=${err.message}, attempts=${job.attemptsMade}/${job.opts.attempts}`,
          );
        }
      },
    );

    this.queue.on('stalled', (job: Bull.Job<DeletionJob>) => {
      debug(`⏸️ 停滞 jobId=${job.id}, chatId=${job.data.chatId}`);
    });

    this.queue.on('error', (error: Error) => {
      debug(`❌ 队列错误: ${error.message}`);
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
    debug('👋 队列已关闭');
  }
}

// 单例
let instance: DeletionQueue | null = null;

export function getDeletionQueue(): DeletionQueue {
  if (!instance) {
    instance = new DeletionQueue();
  }
  return instance;
}
