import { setupRedis } from '../utils/redis';

import setupDB, { closeDB } from '../utils/db';

import { checkExpiredRecharges } from './cron/recharge/expiredRecharges';
import { checkPendingRecharges } from './cron/recharge/checkPendingRecharges';

import cron from 'node-cron';

import PQueue from 'p-queue';

const task = async () => {
  const startTime = Date.now();

  console.log('当前时间:', new Date().toLocaleString());
  console.log('开始执行充值任务...');

  try {
    // 检查过期充值
    await checkExpiredRecharges();
    // 检查待处理充值
    await checkPendingRecharges();

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`充值任务执行完成 (耗时: ${duration}ms)`);
  } catch (error: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.error(`充值任务执行失败 (耗时: ${duration}ms):`, error.message);
    throw error;
  }
};

// 初始化数据库和 Redis
(async () => {
  await setupDB();
  await setupRedis();
  console.log('数据库和 Redis 连接已建立');

  // 创建队列，高频任务防护配置
  const MAX_QUEUE_SIZE = 5; // 队列最大长度
  const queue = new PQueue({
    concurrency: 1, // 串行执行
    autoStart: true, // 自动开始
  });

  // 🔐 任务超时配置（5分钟）
  queue.timeout = 300000; // 单个任务超时时间(5分钟)

  // 📊 监听队列状态（v6 版本使用 Promise 方式）
  queue.onEmpty().then(() => {
    console.log('[充值任务] 队列已空');
  });
  queue.onIdle().then(() => {
    console.log('[充值任务] 所有任务完成');
  });

  // 使用 node-cron 每30秒执行一次
  cron.schedule(
    '*/30 * * * * *',
    () => {
      const queueSize = queue.size;
      const pendingSize = queue.pending;

      // 如果队列已满，跳过本次任务添加
      if (queueSize >= MAX_QUEUE_SIZE) {
        console.warn(
          `[充值任务] 队列已满！跳过本次任务。队列大小: ${queueSize}, 执行中: ${pendingSize}`,
        );
        return;
      }

      // 如果队列中有等待的任务，记录警告
      if (queueSize > 0) {
        console.warn(
          `[充值任务] 队列中有 ${queueSize} 个任务等待执行，当前执行中: ${pendingSize}`,
        );
      }

      queue
        .add(async () => {
          const startTime = Date.now();
          try {
            console.log('充值任务开始:', new Date().toISOString());
            await task();
            const duration = Date.now() - startTime;
            console.log(
              `充值任务结束: ${new Date().toISOString()}, 耗时: ${duration}ms`,
            );

            // 如果执行时间超过间隔时间，发出警告
            if (duration > 30000) {
              console.warn(
                `[充值任务] 任务执行时间 ${duration}ms 超过间隔时间 30秒，可能导致任务堆积`,
              );
            }
          } catch (err) {
            const duration = Date.now() - startTime;
            console.error(`充值任务执行失败 (耗时: ${duration}ms):`, err);
          }
        })
        .catch((err) => {
          console.error('充值任务添加到队列失败:', err);
        });
    },
    {
      timezone: 'Asia/Shanghai',
    },
  );

  console.log('充值任务定时任务已启动，每30秒执行一次（使用队列防止任务重叠）');

  // 优雅退出处理
  process.on('SIGINT', async () => {
    console.log('收到 SIGINT 信号，正在关闭...');
    await closeDB();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('收到 SIGTERM 信号，正在关闭...');
    await closeDB();
    process.exit(0);
  });
})();
