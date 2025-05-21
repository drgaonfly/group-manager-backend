import setupDB from '../utils/db';
import { checkExpiredSubscriptions } from './cron/isSubscriptionExpired';
// import { checkIsOnline } from './cron/checkIsOnline';

const task = async () => {
  await setupDB();

  await checkExpiredSubscriptions();
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
