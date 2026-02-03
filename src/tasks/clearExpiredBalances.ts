import { setupRedis } from '../utils/redis';
import setupDB, { closeDB } from '../utils/db';

import { clearExpiredBalances } from './cron/clearExpiredBalances';
import cron from 'node-cron';
import PQueue from 'p-queue';

const task = async () => {
  console.log('当前时间:', new Date().toLocaleString());
  console.log('开始执行余额清零任务...');

  await clearExpiredBalances();
};

// 初始化数据库和 Redis
(async () => {
  await setupDB();
  await setupRedis();
  console.log('数据库和 Redis 连接已建立');

  // 创建队列，同一时间只执行一个任务，防止任务重叠
  const queue = new PQueue({ concurrency: 1 });

  // 使用 node-cron 每天凌晨1点执行一次（0 1 * * *）
  cron.schedule(
    '0 1 * * *',
    () => {
      queue.add(async () => {
        try {
          console.log('余额清零任务开始:', new Date().toISOString());
          await task();
          console.log('余额清零任务结束:', new Date().toISOString());
        } catch (err) {
          console.error('余额清零任务执行失败:', err);
        }
      });
    },
    {
      timezone: 'Asia/Shanghai',
    },
  );

  console.log(
    '余额清零定时任务已启动，每天凌晨1点执行一次（使用队列防止任务重叠）',
  );

  // 优雅退出处理
  process.on('SIGINT', async () => {
    console.log('收到 SIGINT 信号，正在关闭...');
    await closeDB();
    process.exit(0);
  });
})();
