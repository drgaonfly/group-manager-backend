import { setupRedis } from '../utils/redis';
import setupDB, { closeDB } from '../utils/db';

import { sendGroupMessages } from './cron/groupMessager';
import cron from 'node-cron';

const task = async () => {
  console.log('当前时间:', new Date().toLocaleString());
  console.log('开始执行群发消息任务...');

  await sendGroupMessages();
};

// 初始化数据库和 Redis
(async () => {
  await setupDB();
  await setupRedis();
  console.log('数据库和 Redis 连接已建立');

  // 使用 node-cron 每10秒执行一次
  cron.schedule(
    '*/10 * * * * *',
    async () => {
      try {
        await task();
      } catch (err) {
        console.error('群发消息任务执行失败:', err);
      }
    },
    {
      timezone: 'Asia/Shanghai',
    },
  );

  console.log('群发消息定时任务已启动，每10秒执行一次');

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
