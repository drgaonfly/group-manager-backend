import setupDB from '../utils/db';
import { checkExpiredOrders } from './cron/expiredOrders';
// import { checkExpiredSubscriptions } from './cron/isSubscriptionExpired';
import { trialExpired } from './cron/trialExpired';
import { checkPendingOrders } from './cron/checkPendingOrders';

const task = async () => {
  await setupDB();
  await trialExpired();
  await checkExpiredOrders();
  await checkPendingOrders();
  // await checkExpiredSubscriptions();
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
