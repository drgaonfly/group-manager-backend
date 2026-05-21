import { setupRedis } from '../utils/redis';
import setupDB, { closeDB } from '../utils/db';
import { checkExpiredAuctions } from './cron/auction/checkExpiredAuctions';

// 初始化数据库和 Redis
(async () => {
  await setupDB();
  await setupRedis();
  console.log('数据库和 Redis 连接已建立');

  // 启动竞拍过期检查任务（只注册一次定时器）
  checkExpiredAuctions();

  // 优雅退出处理
  process.on('SIGINT', async () => {
    console.log('收到 SIGINT 信号，正在关闭...');
    await closeDB();
    process.exit(0);
  });
})();
