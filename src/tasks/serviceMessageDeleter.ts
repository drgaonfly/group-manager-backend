import { setupRedis } from '../utils/redis';
import setupDB, { closeDB } from '../utils/db';
import { deleteServiceMessages } from './cron/serviceMessageDeleter';
import cron from 'node-cron';
import PQueue from 'p-queue';

const task = async () => {
  console.log('当前时间:', new Date().toLocaleString());
  await deleteServiceMessages();
};

// 初始化数据库和 Redis
(async () => {
  await setupDB();
  await setupRedis();
  console.log('数据库和 Redis 连接已建立');

  // concurrency: 1 防止上一轮未结束时下一轮重叠执行
  const queue = new PQueue({ concurrency: 1 });

  // 每分钟执行一次
  cron.schedule(
    '* * * * *',
    () => {
      queue.add(async () => {
        try {
          console.log('删除入群消息任务开始:', new Date().toISOString());
          await task();
          console.log('删除入群消息任务结束:', new Date().toISOString());
        } catch (err) {
          console.error('删除入群消息任务执行失败:', err);
        }
      });
    },
    {
      timezone: 'Asia/Shanghai',
    },
  );

  console.log('删除入群消息定时任务已启动，每分钟执行一次');

  process.on('SIGINT', async () => {
    console.log('收到 SIGINT 信号，正在关闭...');
    await closeDB();
    process.exit(0);
  });
})();
