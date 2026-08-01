import Bull from 'bull';
import { redis } from './redis';
import createDebug from 'debug';

const debug = createDebug('bot:distributed-deletion-queue');

interface DeletionJob {
  chatId: number;
  // 立即删除：messageIds 为空，从 Redis buffer 读取
  // 延迟删除：messageIds 直接存在 Job 里（buffer 不可靠，TTL 会过期）
  messageIds: number[];
  messageTypes: string[];
  botToken: string;
  /** 标记是否从 Redis buffer 读取数据（立即删除模式） */
  useBuffer: boolean;
}

/**
 * 分布式消息删除队列（基于 Bull + Redis）
 *
 * 两种模式：
 *
 * 【立即删除 / 聚合模式】delayMs=0
 *   - 消息写入 Redis List 缓冲（del-buf:{chatId}）
 *   - 同一 chatId 在 500ms 窗口内只创建一个 Bull Job（jobId 去重）
 *   - Job 触发时原子读取并清空缓冲，批量删除
 *   - 1000 人入群 ≈ 200 条消息 → 2-4 个 Job → 2-4 次 deleteMessages API
 *
 * 【延迟删除模式】delayMs>0
 *   - messageId 直接存入 Job payload（不依赖 buffer，TTL 安全）
 *   - 使用 Bull delayed job，持久化，支持多实例，替代 setTimeout
 *   - 同一 chatId + 同一延迟时间槽内去重合并
 */
export class DistributedDeletionQueue {
  private queue: Bull.Queue<DeletionJob>;
  private readonly BATCH_SIZE = 100; // Telegram deleteMessages 单次上限
  private readonly AGGREGATE_WINDOW_MS = 500; // 立即删除聚合窗口
  private readonly PROCESS_CONCURRENCY = 5;

  constructor() {
    if (!redis) {
      throw new Error('Redis 未连接，无法创建分布式队列');
    }

    this.queue = new Bull<DeletionJob>('message-deletion', {
      redis: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
        db: Number(process.env.REDIS_DB),
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    });

    this.setupProcessor();
    this.setupEventListeners();

    debug('✅ 分布式删除队列已初始化');
  }

  /**
   * 添加单条删除任务
   *
   * @param delayMs 0=立即删除（聚合模式），>0=延迟删除（payload 模式）
   */
  async add(
    chatId: number,
    messageId: number,
    messageType: string,
    botToken: string,
    delayMs = 0,
  ): Promise<void> {
    if (delayMs > 0) {
      // ── 延迟删除 ──
      // buffer key 和 lock key 都带时间槽，与 Job 严格一一对应
      const timeSlot = Math.floor(Date.now() / this.AGGREGATE_WINDOW_MS);
      const bufferKey = `del-buf-delay:${chatId}:${delayMs}:${timeSlot}`;
      const lockKey = `del-lock-delay:${chatId}:${delayMs}:${timeSlot}`;

      // 先写入 buffer，TTL = delayMs + 10s
      await redis!.rpush(bufferKey, JSON.stringify({ messageId, messageType }));
      await redis!.pexpire(bufferKey, delayMs + 10000);

      // SET NX：只有第一个请求能拿到锁并创建 Job，后续直接跳过
      // lock TTL 略大于 delay，Job 执行后锁自然过期
      const acquired = await redis!.set(
        lockKey,
        '1',
        'PX',
        delayMs + 15000,
        'NX',
      );
      if (acquired === 'OK') {
        const jobId = `del-delay:${chatId}:${delayMs}:${timeSlot}`;
        await this.queue.add(
          {
            chatId,
            messageIds: [],
            messageTypes: [],
            botToken,
            useBuffer: true,
          },
          { jobId, delay: delayMs },
        );
        debug(`⏰ 延迟 Job 入队 jobId=${jobId}, delay=${delayMs}ms`);
      } else {
        debug(`ℹ️ 延迟 Job 已存在（锁命中），跳过创建 chatId=${chatId}`);
      }
    } else {
      // ── 立即删除：聚合模式 ──
      const timeSlot = Math.floor(Date.now() / this.AGGREGATE_WINDOW_MS);
      const bufferKey = `del-buf:${chatId}:${timeSlot}`;
      const lockKey = `del-lock:${chatId}:${timeSlot}`;

      // 写入当前时间槽专属的 buffer，TTL = 聚合窗口 + 5s
      await redis!.rpush(bufferKey, JSON.stringify({ messageId, messageType }));
      await redis!.pexpire(bufferKey, this.AGGREGATE_WINDOW_MS + 5000);

      // SET NX：同一时间槽只创建一个 Job
      const acquired = await redis!.set(
        lockKey,
        '1',
        'PX',
        this.AGGREGATE_WINDOW_MS + 5000,
        'NX',
      );
      if (acquired === 'OK') {
        const jobId = `del:${chatId}:${timeSlot}`;
        await this.queue.add(
          {
            chatId,
            messageIds: [],
            messageTypes: [],
            botToken,
            useBuffer: true,
          },
          { jobId, delay: this.AGGREGATE_WINDOW_MS },
        );
        debug(`📝 立即删除 Job 入队 jobId=${jobId}, chatId=${chatId}`);
      } else {
        debug(
          `ℹ️ Job 已存在（锁命中），跳过创建 chatId=${chatId}, slot=${timeSlot}`,
        );
      }
    }
  }

  /**
   * 直接批量添加（已有完整 messageId 列表时使用）
   */
  async addBatch(
    chatId: number,
    messageIds: number[],
    messageTypes: string[],
    botToken: string,
    delayMs = 0,
  ): Promise<void> {
    for (let i = 0; i < messageIds.length; i += this.BATCH_SIZE) {
      await this.queue.add(
        {
          chatId,
          messageIds: messageIds.slice(i, i + this.BATCH_SIZE),
          messageTypes: messageTypes.slice(i, i + this.BATCH_SIZE),
          botToken,
          useBuffer: false,
        },
        { delay: delayMs },
      );
    }
    debug(
      `📦 批量入队 chatId=${chatId}, count=${
        messageIds.length
      }, jobs=${Math.ceil(messageIds.length / this.BATCH_SIZE)}`,
    );
  }

  private setupProcessor(): void {
    this.queue.process(
      this.PROCESS_CONCURRENCY,
      async (job: Bull.Job<DeletionJob>) => {
        const { chatId, botToken, useBuffer } = job.data;
        let messageIds = job.data.messageIds;
        let messageTypes = job.data.messageTypes;

        if (useBuffer) {
          // 从 jobId 推断用哪个 buffer key
          // jobId 格式：del:{chatId}:{slot} 或 del-delay:{chatId}:{delayMs}:{slot}
          const jobId = String(job.id);
          const isDelayed = jobId.startsWith('del-delay:');
          // jobId 和 bufferKey 命名规则完全对应，直接替换前缀即可
          // del:{chatId}:{slot}             → del-buf:{chatId}:{slot}
          // del-delay:{chatId}:{ms}:{slot}  → del-buf-delay:{chatId}:{ms}:{slot}
          const bufferKey = isDelayed
            ? jobId.replace('del-delay:', 'del-buf-delay:')
            : jobId.replace('del:', 'del-buf:');

          // 原子读取并清空 buffer，防止多实例竞争
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
              `📥 从 buffer 读取 chatId=${chatId}, count=${messageIds.length}, key=${bufferKey}`,
            );
          }
        }

        if (messageIds.length === 0) {
          debug(`⚠️ 空作业跳过 jobId=${job.id}`);
          return { success: true, deletedCount: 0 };
        }

        const { setupBot } = await import('../bot/botSetup');
        const bot = setupBot(botToken);
        let deletedCount = 0;

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
            debug(`✅ 删除 chatId=${chatId}, count=${batchIds.length}`);
          } catch (e: any) {
            if (e.description?.includes('method not found')) {
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
              debug(`⚠️ 消息不存在或无权限，跳过本批`);
              deletedCount += batchIds.length;
            } else {
              throw e; // 交给 Bull 重试
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

let queueInstance: DistributedDeletionQueue | null = null;

export function getDistributedDeletionQueue(): DistributedDeletionQueue {
  if (!queueInstance) {
    queueInstance = new DistributedDeletionQueue();
  }
  return queueInstance;
}
