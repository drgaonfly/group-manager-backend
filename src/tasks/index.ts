import cron from 'node-cron';
import { updatePoolValues } from './cron/updatePoolValues';

// 启动定时任务
export const scheduledtasks = (): void => {
  if (process.env.CRON_ENABLE === 'true') {
    // 每2秒执行一次更新
    setInterval(updatePoolValues, 2000);

    // 其他定时任务可以使用 cron
    cron.schedule(
      '* * * * *',
      () => {
        // 其他每分钟执行的任务
      },
      {
        scheduled: true,
        timezone: 'Asia/Shanghai',
      },
    );

    console.log('定时任务已启动：');
    console.log('- 池子数值更新：每2秒执行一次');
    console.log('- 其他任务：每分钟执行一次');
  } else {
    console.log('开发环境下，定时任务未启动');
  }
};
