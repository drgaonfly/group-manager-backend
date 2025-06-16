import setupDB from '../utils/db';
import { checkExpiredPayments } from './cron/expiredPayments';
import { checkExpiredSubscriptions } from './cron/checkExpiredSubscriptions';
import { trialExpired } from './cron/trialExpired';
import { checkPendingOrders } from './cron/checkPendingOrders';
import { updateBotExpiration } from './cron/updateBotExpiration';
import { notifyBotExpiration } from './cron/notifyBotExpiration';
import { notifySubscriptionExpiration } from './cron/notifySubscriptionExpiration';
import { checkTransfer } from './cron/checkTransfer';
import { setupRedis } from '../utils/redis';

const task = async () => {
  await setupDB();
  await setupRedis();
  console.log('当前时间:', new Date().toLocaleString());
  console.log('开始执行任务...');
  await trialExpired();
  await checkExpiredPayments();
  await checkPendingOrders();
  await notifySubscriptionExpiration();
  await checkExpiredSubscriptions();
  await notifyBotExpiration();
  await updateBotExpiration();
  await checkTransfer();
};

// 执行任务并在完成后退出进程
task()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Task failed:', err);
    process.exit(1);
  });
