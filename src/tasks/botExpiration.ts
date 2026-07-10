import { setupRedis } from '../utils/redis';
import setupDB, { closeDB } from '../utils/db';
import { notifyBotExpiration } from './cron/notifyBotExpiration';
import { updateBotExpiration } from './cron/updateBotExpiration';
import cron from 'node-cron';

// 初始化数据库和 Redis
(async () => {
  await setupDB();
  await setupRedis();
  console.log('数据库和 Redis 连接已建立');

  // 每天早上 9 点检查即将过期的机器人（提前3天提醒）
  cron.schedule(
    '0 9 * * *',
    async () => {
      try {
        console.log(
          '[botExpiration] 开始执行过期提醒任务:',
          new Date().toISOString(),
        );
        await notifyBotExpiration();
        console.log(
          '[botExpiration] 过期提醒任务完成:',
          new Date().toISOString(),
        );
      } catch (err) {
        console.error('[botExpiration] 过期提醒任务执行失败:', err);
      }
    },
    {
      timezone: 'Asia/Shanghai',
    },
  );

  // 每天早上 9 点检查已过期的机器人并发送通知
  cron.schedule(
    '0 9 * * *',
    async () => {
      try {
        console.log(
          '[botExpiration] 开始执行过期通知任务:',
          new Date().toISOString(),
        );
        await updateBotExpiration();
        console.log(
          '[botExpiration] 过期通知任务完成:',
          new Date().toISOString(),
        );
      } catch (err) {
        console.error('[botExpiration] 过期通知任务执行失败:', err);
      }
    },
    {
      timezone: 'Asia/Shanghai',
    },
  );

  console.log('机器人过期定时任务已启动，每天早上9点执行');

  // 优雅退出处理
  process.on('SIGINT', async () => {
    console.log('收到 SIGINT 信号，正在关闭...');
    await closeDB();
    process.exit(0);
  });
})();
