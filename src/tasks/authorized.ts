import cron from 'node-cron';
import { generateFlowingIncome } from '../controllers/incomeController';

// 启动定时任务
export const authorized = async (): Promise<void> => {
  if (process.env.CRON_AUTHORIZED === 'true') {
    try {
      // 修改定时任务为每十分钟运行一次，这样可以更精确地检查用户参与时间
      const cronExpression = `*/10 * * * *`;

      // 创建定时任务
      cron.schedule(
        cronExpression,
        async () => {
          try {
            await generateFlowingIncome();
          } catch (error) {
            console.error('执行定时收益生成任务时发生错误:', error);
          }
        },
        {
          scheduled: true,
          timezone: 'Asia/Shanghai',
        },
      );

      console.log('定时任务已启动：');
      console.log(`- 授权用户收益生成：每小时检查一次`);
    } catch (error) {
      console.error('启动定时任务时发生错误:', error);
    }
  } else {
    console.log('开发环境下，定时任务未启动');
  }
};
