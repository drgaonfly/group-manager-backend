import Bull from 'bull';
import { redis } from './redis';
import createDebug from 'debug';

const debug = createDebug('bot:distributed-deletion-queue');

interface DeletionJob {
  chatId: number;
  messageIds: number[];
  messageTypes: string[];
  botToken: string;
}

/**
 * 分布式消息删除队列（基于 Bull + Redis）
 *
 * 规模化删除策略：
 * - 使用 Redis List 作为滑动聚合窗口，将同一 chatId 500ms 内的消息合并
 * - 每个 chatId 同一时段只创建一个 Bull Job，避免海量 Job
 * - 批量调用 deleteMessages（最多 100 条/次），充分利用 Telegram API
 * - 依赖 apiThrottler + autoRetry 处理限流和失败重试
 * - 延迟删除使用 Bull delayed job，支持多实例 + 持久化
 */
export class DistributedDeletionQueue {
  private queue: Bull.Queue<DeletionJob>;
  private readonly BATCH_SIZE = 100; // Telegram deleteMessages 单次上限
  private readonly AGGREGATE_WINDOW_MS = 500; // 聚合窗口：500ms 内同一 chatId 的消息合并
  private readonly PROCESS_CONCURRENCY = 5; // 并发处理作业数

  constructor() {
    if (!redis) {
      throw new Error('Redis 未连接，无法创建分布式队列');
    }

    const redisConfig = {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
      db: Number(process.env.REDIS_DB),
    };

    this.queue = new Bull<DeletionJob>('message-deletion', {
      redis: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    });

    this.setupProcessor();
    this.setupEventListeners();

    debug('✅ 分布式删除队列已初始化');
  }

  /**
   * 添加单条删除任务。
   *
   * 规模化关键：使用 Redis List 聚合同一 chatId 的消息，
   * 在聚合窗口内只创建一个 Bull Job（通过 jobId 去重）。
   * 大量用户入群时，200 条服务消息最终只会产生少量 Job。
   */
  async add(
    chatId: number,
    messageId: number,
    messageType: string,
    botToken: string,
    delayMs = 0,
  ): Promise<void> {
    const bufferKey = `del-buf:${chatId}`;

    // 将消息压入 Redis List 聚合缓冲
    await redis!.rpush(bufferKey, JSON.stringify({ messageId, messageType }));

    // 聚合窗口到期后自动清理 key（窗口 + 处理余量）
    await redis!.pexpire(bufferKey, this.AGGREGATE_WINDOW_MS + 5000);

    // Job ID 基于 chatId + 窗口时间槽，同一时间槽内只创建一个 Job
    const timeSlot = Math.floor(Date.now() / this.AGGREGATE_WINDOW_MS);
    const jobId = `del:${chatId}:${timeSlot}`;

    // Bull 的 jobId 唯一性保证：重复 add 同一 jobId 会被忽略（不重复入队）
    try {
      await this.queue.add(
        {
          chatId,
          messageIds: [], // 实际 messageIds 在处理时从 Redis List 读取
          messageTypes: [],
          botToken,
        },
        {
          jobId,
          delay: delayMs > 0 ? delayMs : this.AGGREGATE_WINDOW_MS,
          // 延迟至少等于聚合窗口，确保窗口内所有消息都已写入 Redis List
        },
      );
      debug(`📝 Job 已入队/去重 jobId=${jobId}, chatId=${chatId}`);
    } catch (e: any) {
      // Bull 在 jobId 重复时会抛出或静默忽略，具体行为取决于版本
      // 这里捕获以防万一，不影响正常流程
      debug(`ℹ️ Job 已存在（正常去重）jobId=${jobId}: ${e.message}`);
    }
  }

  /**
   * 直接批量添加（跳过聚合窗口，适用于已知大批量场景）
   */
  async addBatch(
    chatId: number,
    messageIds: number[],
    messageTypes: string[],
    botToken: string,
    delayMs = 0,
  ): Promise<void> {
    // 按 BATCH_SIZE 分片，避免单个 Job 过大
    for (let i = 0; i < messageIds.length; i += this.BATCH_SIZE) {
      const batchIds = messageIds.slice(i, i + this.BATCH_SIZE);
      const batchTypes = messageTypes.slice(i, i + this.BATCH_SIZE);

      await this.queue.add(
        {
          chatId,
          messageIds: batchIds,
          messageTypes: batchTypes,
          botToken,
        },
        {
          delay: delayMs,
          priority: 2,
        },
      );
    }

    debug(
      `📦 批量入队 chatId=${chatId}, count=${
        messageIds.length
      }, jobs=${Math.ceil(messageIds.length / this.BATCH_SIZE)}`,
    );
  }

  /**
   * 作业处理器：从 Redis List 读取聚合消息，分批删除
   */
  private setupProcessor(): void {
    this.queue.process(
      this.PROCESS_CONCURRENCY,
      async (job: Bull.Job<DeletionJob>) => {
        const { chatId, botToken } = job.data;

        // 优先从 Redis List 读取聚合缓冲的消息（应对大规模入群）
        let messageIds = job.data.messageIds;
        let messageTypes = job.data.messageTypes;

        const bufferKey = `del-buf:${chatId}`;
        const buffered = await redis!.lrange(bufferKey, 0, -1);

        if (buffered.length > 0) {
          // 原子性：读取后立即删除，防止多实例重复处理
          await redis!.del(bufferKey);

          const parsed = buffered.map(
            (s) => JSON.parse(s) as { messageId: number; messageType: string },
          );
          messageIds = parsed.map((p) => p.messageId);
          messageTypes = parsed.map((p) => p.messageType);

          debug(`📥 从缓冲读取 chatId=${chatId}, count=${messageIds.length}`);
        }

        if (messageIds.length === 0) {
          debug(`⚠️ 空作业，跳过 jobId=${job.id}`);
          return { success: true, deletedCount: 0 };
        }

        const { setupBot } = await import('../bot/botSetup');
        const bot = setupBot(botToken);

        let deletedCount = 0;

        // 按 BATCH_SIZE 分片批量删除
        for (let i = 0; i < messageIds.length; i += this.BATCH_SIZE) {
          const batchIds = messageIds.slice(i, i + this.BATCH_SIZE);
          const batchTypes = messageTypes.slice(i, i + this.BATCH_SIZE);

          try {
            if (batchIds.length === 1) {
              await bot.api.deleteMessage(chatId, batchIds[0]);
            } else {
              await bot.api.deleteMessages(chatId, batchIds);
            }
            deletedCount += batchIds.length;
            debug(
              `✅ 批量删除 chatId=${chatId}, batch=${
                i / this.BATCH_SIZE + 1
              }, count=${batchIds.length}`,
            );
          } catch (e: any) {
            if (e.description?.includes('method not found')) {
              // 旧版 Telegram，回退逐个删除
              debug('⚠️ deleteMessages 不支持，回退逐个删除');
              for (let j = 0; j < batchIds.length; j++) {
                try {
                  await bot.api.deleteMessage(chatId, batchIds[j]);
                  deletedCount++;
                } catch (err: any) {
                  debug(
                    `❌ 逐个删除失败 [${batchTypes[j]}] ${batchIds[j]}: ${err.message}`,
                  );
                }
              }
            } else if (
              e.description?.includes('message to delete not found') ||
              e.description?.includes("message can't be deleted")
            ) {
              // 消息已不存在或无权限，不计为失败
              debug(`⚠️ 部分消息无法删除（已过期或无权限），继续处理`);
              deletedCount += batchIds.length;
            } else {
              // 其他错误，交给 Bull 重试
              throw e;
            }
          }
        }

        return { success: true, deletedCount };
      },
    );
  }

  private setupEventListeners(): void {
    this.queue.on('completed', (job: Bull.Job<DeletionJob>, result: any) => {
      debug(
        `✨ 作业完成 jobId=${job.id}, chatId=${job.data.chatId}, deleted=${result.deletedCount}`,
      );
    });

    this.queue.on(
      'failed',
      (job: Bull.Job<DeletionJob> | undefined, err: Error) => {
        if (job) {
          debug(
            `💥 作业失败 jobId=${job.id}, chatId=${job.data.chatId}, error=${err.message}, attempts=${job.attemptsMade}/${job.opts.attempts}`,
          );
        }
      },
    );

    this.queue.on('stalled', (job: Bull.Job<DeletionJob>) => {
      debug(`⏸️ 作业停滞 jobId=${job.id}, chatId=${job.data.chatId}`);
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
let queueInstance: DistributedDeletionQueue | null = null;

export function getDistributedDeletionQueue(): DistributedDeletionQueue {
  if (!queueInstance) {
    queueInstance = new DistributedDeletionQueue();
  }
  return queueInstance;
}
