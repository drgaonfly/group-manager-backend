import { setupRedis } from '../utils/redis';
import setupDB, { closeDB } from '../utils/db';

import { processActivityRewards } from './cron/activityReward';
import cron from 'node-cron';
import PQueue from 'p-queue';

const task = async () => {
  console.log('当前时间:', new Date().toLocaleString());
  console.log('开始执行活跃奖励结算任务...');

  await processActivityRewards();
};

// 初始化数据库和 Redis
(async () => {
  await setupDB();
  await setupRedis();
  console.log('数据库和 Redis 连接已建立');

  // 创建队列，同一时间只执行一个任务，防止任务重叠
  const queue = new PQueue({ concurrency: 1 });

  // 每天 00:00 执行一次
  // daily 机器人每天结算；weekly 机器人仅周一触发；monthly 机器人仅每月 1 日触发
  cron.schedule(
    '0 0 * * *',
    () => {
      queue.add(async () => {
        try {
          console.log('活跃奖励结算任务开始:', new Date().toISOString());
          await task();
          console.log('活跃奖励结算任务结束:', new Date().toISOString());
        } catch (err) {
          console.error('活跃奖励结算任务执行失败:', err);
        }
      });
    },
    {
      timezone: 'Asia/Shanghai',
    },
  );

  console.log('活跃奖励结算定时任务已启动，每天 00:00 执行（Asia/Shanghai）');

  // 优雅退出处理
  process.on('SIGINT', async () => {
    console.log('收到 SIGINT 信号，正在关闭...');
    await closeDB();
    process.exit(0);
  });
})();
