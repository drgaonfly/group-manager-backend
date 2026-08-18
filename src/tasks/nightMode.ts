import { setupRedis } from '../utils/redis';
import setupDB, { closeDB } from '../utils/db';
import { checkNightModes } from './cron/nightMode';
import cron from 'node-cron';
import PQueue from 'p-queue';

// 初始化数据库和 Redis
(async () => {
  await setupDB();
  await setupRedis();
  console.log('[NightMode] 数据库和 Redis 连接已建立');

  const queue = new PQueue({ concurrency: 1 });

  // 每分钟整点执行（精确到分钟，与 startAt/endAt 对齐）
  cron.schedule('* * * * *', () => {
    queue.add(async () => {
      try {
        console.log('[NightMode] 检查开始:', new Date().toISOString());
        await checkNightModes();
        console.log('[NightMode] 检查完成:', new Date().toISOString());
      } catch (err) {
        console.error('[NightMode] 任务执行失败:', err);
      }
    });
  });

  console.log('[NightMode] 夜间模式定时任务已启动，每分钟执行一次');

  process.on('SIGINT', async () => {
    console.log('[NightMode] 收到 SIGINT，正在关闭...');
    await closeDB();
    process.exit(0);
  });
})();
