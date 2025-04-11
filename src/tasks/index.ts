import { updatePoolValues } from './cron/updatePoolValues';
import { checkActivityStatus } from './cron/checkActivityStatus';
import { checkReleaseRecords } from './cron/checkReleaseRecords';
import setupDB from '../utils/db';
import { generateFlowingIncome } from './authorized';
import { generateStakingIncome } from './stacking';

// 启动定时任务
// export const scheduledtasks = (): void => {
//   if (process.env.CRON_ENABLE === 'true') {
//     cron.schedule(
//       '* * * * *',
//       async () => {
//         await updatePoolValues();
//       },
//       {
//         scheduled: true,
//         timezone: 'Asia/Shanghai',
//       },
//     );

//     // 每分钟检查一次活动状态
//     cron.schedule(
//       '* * * * *',
//       async () => {
//         await checkActivityStatus();
//       },
//       {
//         scheduled: true,
//         timezone: 'Asia/Shanghai',
//       },
//     );

//     // 每分钟检查一次解押记录状态
//     cron.schedule(
//       '* * * * *',
//       async () => {
//         await checkReleaseRecords();
//       },
//       {
//         scheduled: true,
//         timezone: 'Asia/Shanghai',
//       },
//     );

//     console.log('定时任务已启动：');
//     console.log('- 池子数值更新：每3秒执行一次');
//     console.log('- 活动状态检查：每分钟执行一次');
//     console.log('- 解押记录检查：每小时执行一次');
//   } else {
//     console.log('开发环境下，定时任务未启动');
//   }
// };

setupDB();

const task = async () => {
  await checkActivityStatus();
  await updatePoolValues();
  await checkReleaseRecords();
  await generateFlowingIncome();
  await generateStakingIncome();
  process.exit(0);
};

task();
