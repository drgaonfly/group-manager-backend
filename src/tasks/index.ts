import setupDB from '../utils/db';
// import { checkExpiredPayments } from './cron/expiredPayments';
// import { checkExpiredSubscriptions } from './cron/checkExpiredSubscriptions';
// import { trialExpired } from './cron/trialExpired';
// import { checkPendingOrders } from './cron/checkPendingOrders';
// import { updateBotExpiration } from './cron/updateBotExpiration';
// import { notifyBotExpiration } from './cron/notifyBotExpiration';
// import { notifySubscriptionExpiration } from './cron/notifySubscriptionExpiration';
// import cron from 'node-cron';
import { checkUsdtWallets } from './cron/checkUsdtWallets';
import { checkTrxWallets } from './cron/checkTrxWallets';
// import { checkPendingExchanges } from './cron/checkPendingExchanges';
// import { checkExpiredExchanges } from './cron/expiredExchange';
// import { sendGroupMessages } from './cron/groupMessager';
// import { checkAutoExchanges } from './cron/checkAutoExchanges';
import { setupRedis } from '../utils/redis';

const task = async () => {
  await setupDB();
  await setupRedis();
  console.log('当前时间:', new Date().toLocaleString());
  console.log('开始执行任务...');
  // await trialExpired();
  // await checkExpiredPayments();
  // await checkPendingOrders();
  // await notifySubscriptionExpiration();
  // await checkExpiredSubscriptions();
  // await notifyBotExpiration();
  // await updateBotExpiration();
  await checkUsdtWallets(); // 检查转账记录
  await checkTrxWallets();
  // await checkExpiredExchanges(); // 检查过期的兑换记录
  // await checkPendingExchanges(); // 为他人兑换
  // await checkAutoExchanges(); // 检查授权兑换
  // await sendGroupMessages(); // 发送群发消息
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

// export function startTaskScheduler() {
//   cron.schedule('* * * * *', async () => {
//     console.log(`[定时任务] ${new Date().toLocaleString()} 开始执行`);
//     try {
//       await task();
//       console.log('[定时任务] 执行完成 ✅');
//     } catch (error) {
//       console.error('[定时任务] 执行出错 ❌', error);
//     }
//   });
// }
