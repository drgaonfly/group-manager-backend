import { setupRedis } from '../utils/redis';
import setupDB, { closeDB } from '../utils/db';

import { sendGroupMessages } from './cron/groupMessager';
import { checkAndDrawLotteries } from './cron/lottery/lotteryDraw';
import cron from 'node-cron';
import PQueue from 'p-queue';

const task = async () => {
  console.log('当前时间:', new Date().toLocaleString());
  console.log('开始执行定时任务...');

  // 执行群发消息任务
  console.log('开始执行群发消息任务...');
  await sendGroupMessages();

  // 执行抽奖开奖任务
  console.log('开始执行抽奖开奖任务...');
  await checkAndDrawLotteries();
};

// 初始化数据库和 Redis
(async () => {
  await setupDB();
  await setupRedis();
  console.log('数据库和 Redis 连接已建立');

  // 创建队列，同一时间只执行一个任务，防止任务重叠
  const queue = new PQueue({ concurrency: 1 });

  // 使用 node-cron 每10秒执行一次
  cron.schedule(
    '*/10 * * * * *',
    () => {
      queue.add(async () => {
        try {
          console.log('群发消息任务开始:', new Date().toISOString());
          await task();
          console.log('群发消息任务结束:', new Date().toISOString());
        } catch (err) {
          console.error('群发消息任务执行失败:', err);
        }
      });
    },
    {
      timezone: 'Asia/Shanghai',
    },
  );

  console.log('群发消息定时任务已启动，每10秒执行一次（使用队列防止任务重叠）');

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
