import { setupRedis } from '../utils/redis';
import setupDB, { closeDB } from '../utils/db';
import { checkExpiredRedPackets } from './cron/redpacket/checkExpiredRedPackets';

// 初始化数据库和 Redis
(async () => {
  await setupDB();
  await setupRedis();
  console.log('数据库和 Redis 连接已建立');

  // 启动红包过期结算任务
  checkExpiredRedPackets();

  // 优雅退出处理
  process.on('SIGINT', async () => {
    console.log('收到 SIGINT 信号，正在关闭...');
    await closeDB();
    process.exit(0);
  });
})();
