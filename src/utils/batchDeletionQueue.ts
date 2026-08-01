import createDebug from 'debug';

const debug = createDebug('bot:batch-deletion-queue');

interface QueueItem {
  messageId: number;
  messageType: string;
  timestamp: number;
}

interface BatchDeletionConfig {
  batchSize: number;
  batchInterval: number;
  maxQueueSize: number;
  cleanupInterval: number;
}

/**
 * 批量删除队列管理器
 *
 * 基于 Grammy.js 官方建议优化：
 * - batchSize: 100（Telegram API 限制）
 * - batchInterval: 200ms（不人为限流，给 throttler 缓冲）
 * - 依赖 apiThrottler() 和 autoRetry() 处理速率限制
 *
 * 参考：https://grammy.dev/advanced/flood
 */
export class BatchDeletionQueue {
  private queues = new Map<number, QueueItem[]>();
  private timers = new Map<number, NodeJS.Timeout>();
  private cleanupTimer: NodeJS.Timeout;
  private config: BatchDeletionConfig;

  constructor(config?: Partial<BatchDeletionConfig>) {
    this.config = {
      batchSize: 100,
      batchInterval: 200,
      maxQueueSize: 10000,
      cleanupInterval: 300000,
      ...config,
    };

    // 定期清理过期队列
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredQueues();
    }, this.config.cleanupInterval);
  }

  /**
   * 添加消息到删除队列
   */
  add(chatId: number, messageId: number, messageType: string, api: any): void {
    let queue = this.queues.get(chatId);
    if (!queue) {
      queue = [];
      this.queues.set(chatId, queue);
    }

    // 防止队列过大
    if (queue.length >= this.config.maxQueueSize) {
      debug(
        `⚠️ chatId=${chatId} 队列已满 (${this.config.maxQueueSize})，丢弃旧消息`,
      );
      queue.shift();
    }

    queue.push({ messageId, messageType, timestamp: Date.now() });
    debug(
      `📝 加入队列 chatId=${chatId}, messageId=${messageId}, type=${messageType}, queue_size=${queue.length}`,
    );

    // 如果当前没有在处理批次，启动批处理
    if (!this.timers.has(chatId)) {
      this.scheduleBatch(chatId, api);
    }
  }

  /**
   * 调度批处理任务
   */
  private scheduleBatch(chatId: number, api: any): void {
    const timer = setTimeout(() => {
      this.executeBatch(chatId, api);
    }, this.config.batchInterval);
    this.timers.set(chatId, timer);
  }

  /**
   * 执行批量删除
   */
  private async executeBatch(chatId: number, api: any): Promise<void> {
    const queue = this.queues.get(chatId);
    if (!queue || queue.length === 0) {
      return;
    }

    // 取出一批消息
    const batch = queue.splice(0, this.config.batchSize);
    const messageIds = batch.map((item) => item.messageId);

    debug(
      `🔄 批量删除 chatId=${chatId}, count=${messageIds.length}, queue_remaining=${queue.length}`,
    );

    try {
      if (messageIds.length === 1) {
        // 单条消息直接删除
        await api.deleteMessage(chatId, messageIds[0]);
        debug(`✅ 删除成功 [${batch[0].messageType}] ${messageIds[0]}`);
      } else {
        // 尝试批量删除（Bot API 6.5+）
        try {
          await api.deleteMessages(chatId, messageIds);
          debug(
            `✅ 批量删除成功 count=${messageIds.length}, types=[${batch
              .map((b) => b.messageType)
              .join(', ')}]`,
          );
        } catch (e: any) {
          // 如果不支持批量删除，回退到逐个删除
          if (e.description?.includes('method not found')) {
            debug('⚠️ Bot API 不支持批量删除，回退到逐个删除');
            await this.fallbackDelete(chatId, batch, api);
          } else {
            throw e;
          }
        }
      }
    } catch (e: any) {
      debug(`❌ 批量删除失败 chatId=${chatId}: ${e.message}`);
      // 失败的消息重新入队（限制1分钟内）
      this.requeue(queue, batch);
    }

    // 继续处理或清理
    if (queue.length > 0) {
      this.scheduleBatch(chatId, api);
    } else {
      this.cleanup(chatId);
    }
  }

  /**
   * 回退到逐个删除
   */
  private async fallbackDelete(
    chatId: number,
    batch: QueueItem[],
    api: any,
  ): Promise<void> {
    for (const item of batch) {
      try {
        await api.deleteMessage(chatId, item.messageId);
        debug(`✅ 删除成功 [${item.messageType}] ${item.messageId}`);
      } catch (err: any) {
        debug(
          `❌ 删除失败 [${item.messageType}] ${item.messageId}: ${err.message}`,
        );
      }
    }
  }

  /**
   * 失败消息重新入队
   */
  private requeue(queue: QueueItem[], batch: QueueItem[]): void {
    const now = Date.now();
    batch.forEach((item) => {
      // 只重试1分钟内的消息
      if (now - item.timestamp < 60000) {
        queue.unshift(item);
      }
    });
  }

  /**
   * 清理单个队列
   */
  private cleanup(chatId: number): void {
    this.queues.delete(chatId);
    const timer = this.timers.get(chatId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(chatId);
    }
    debug(`✨ chatId=${chatId} 队列已清空`);
  }

  /**
   * 清理过期队列
   */
  private cleanupExpiredQueues(): void {
    const now = Date.now();
    for (const [chatId, queue] of this.queues.entries()) {
      // 清理超过5分钟的消息
      const validMessages = queue.filter(
        (item) => now - item.timestamp < 300000,
      );

      if (validMessages.length === 0) {
        this.cleanup(chatId);
        debug(`🧹 清理过期队列 chatId=${chatId}`);
      } else if (validMessages.length < queue.length) {
        this.queues.set(chatId, validMessages);
        debug(
          `🧹 清理过期消息 chatId=${chatId}, removed=${
            queue.length - validMessages.length
          }`,
        );
      }
    }
  }

  /**
   * 销毁队列（清理资源）
   */
  destroy(): void {
    clearInterval(this.cleanupTimer);
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.queues.clear();
  }
}
