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
 * 优势：
 * - 跨多实例共享队列
 * - 自动持久化到 Redis
 * - 内置重试机制
 * - 作业状态追踪
 * - 支持优先级和延迟
 *
 * 基于 Grammy.js 官方建议：
 * - 批量删除 100 条/次
 * - 依赖 apiThrottler 和 autoRetry
 * - 不人为限流
 */
export class DistributedDeletionQueue {
  private queue: Bull.Queue<DeletionJob>;
  private batchSize: number;
  private readonly PROCESS_CONCURRENCY = 3; // 同时处理 3 个作业

  constructor() {
    if (!redis) {
      throw new Error('Redis 未连接，无法创建分布式队列');
    }

    this.batchSize = 100;

    // 创建 Bull 队列，复用已有的 redis 连接配置
    this.queue = new Bull<DeletionJob>('message-deletion', {
      redis: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
        db: Number(process.env.REDIS_DB),
      },
      defaultJobOptions: {
        attempts: 3, // 最多重试 3 次
        backoff: {
          type: 'exponential',
          delay: 2000, // 2秒起始延迟
        },
        removeOnComplete: true, // 完成后自动删除
        removeOnFail: 100, // 保留最近 100 个失败作业
      },
    });

    // 注册处理器
    this.setupProcessor();

    // 事件监听
    this.setupEventListeners();

    debug('✅ 分布式删除队列已初始化');
  }

  /**
   * 添加删除任务到队列
   */
  async add(
    chatId: number,
    messageId: number,
    messageType: string,
    botToken: string,
  ): Promise<void> {
    const jobId = `${chatId}-${Date.now()}`;

    // 尝试获取当前 chatId 的待处理作业
    const existingJob = await this.queue.getJob(jobId);

    if (existingJob && existingJob.data.chatId === chatId) {
      // 如果已有该 chatId 的作业，追加消息 ID
      const data = existingJob.data;
      if (data.messageIds.length < this.batchSize) {
        data.messageIds.push(messageId);
        data.messageTypes.push(messageType);
        await existingJob.update(data);
        debug(
          `📝 追加到现有作业 chatId=${chatId}, count=${data.messageIds.length}`,
        );
        return;
      }
    }

    // 创建新作业
    await this.queue.add(
      {
        chatId,
        messageIds: [messageId],
        messageTypes: [messageType],
        botToken,
      },
      {
        jobId,
        priority: 1, // 默认优先级
      },
    );

    debug(
      `📝 创建新作业 chatId=${chatId}, messageId=${messageId}, type=${messageType}`,
    );
  }

  /**
   * 批量添加删除任务
   */
  async addBatch(
    chatId: number,
    messageIds: number[],
    messageTypes: string[],
    botToken: string,
  ): Promise<void> {
    const jobId = `${chatId}-${Date.now()}`;

    await this.queue.add(
      {
        chatId,
        messageIds,
        messageTypes,
        botToken,
      },
      {
        jobId,
        priority: 1,
      },
    );

    debug(
      `📦 批量创建作业 chatId=${chatId}, count=${
        messageIds.length
      }, types=${messageTypes.slice(0, 3).join(',')}...`,
    );
  }

  /**
   * 设置作业处理器
   */
  private setupProcessor(): void {
    this.queue.process(
      this.PROCESS_CONCURRENCY,
      async (job: Bull.Job<DeletionJob>) => {
        const { chatId, messageIds, messageTypes, botToken } = job.data;

        debug(
          `🔄 处理作业 jobId=${job.id}, chatId=${chatId}, count=${messageIds.length}`,
        );

        try {
          // 从 botCache 拿到已配置好 throttler + autoRetry 的 Bot 实例
          const { setupBot } = await import('../bot/botSetup');
          const bot = setupBot(botToken);

          if (messageIds.length === 1) {
            await bot.api.deleteMessage(chatId, messageIds[0]);
            debug(`✅ 删除成功 [${messageTypes[0]}] ${messageIds[0]}`);
          } else {
            try {
              await bot.api.deleteMessages(chatId, messageIds);
              debug(`✅ 批量删除成功 count=${messageIds.length}`);
            } catch (e: any) {
              if (e.description?.includes('method not found')) {
                debug('⚠️ 回退到逐个删除');
                for (let i = 0; i < messageIds.length; i++) {
                  try {
                    await bot.api.deleteMessage(chatId, messageIds[i]);
                  } catch (err: any) {
                    debug(
                      `❌ 删除失败 [${messageTypes[i]}] ${messageIds[i]}: ${err.message}`,
                    );
                  }
                }
              } else {
                throw e;
              }
            }
          }

          return { success: true, deletedCount: messageIds.length };
        } catch (error: any) {
          debug(`❌ 作业失败 jobId=${job.id}: ${error.message}`);
          throw error;
        }
      },
    );
  }

  /**
   * 设置事件监听器
   */
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

  /**
   * 关闭队列（清理资源）
   */
  async close(): Promise<void> {
    await this.queue.close();
    debug('👋 队列已关闭');
  }
}

// 单例实例
let queueInstance: DistributedDeletionQueue | null = null;

/**
 * 获取队列实例（单例）
 */
export function getDistributedDeletionQueue(): DistributedDeletionQueue {
  if (!queueInstance) {
    queueInstance = new DistributedDeletionQueue();
  }
  return queueInstance;
}
