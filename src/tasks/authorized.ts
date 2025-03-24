import cron from 'node-cron';
import { generateFlowingIncome } from '../controllers/incomeController';
import Setting from '../models/setting';

// 启动定时任务
export const authorized = async (): Promise<void> => {
  if (process.env.CRON_AUTHORIZED === 'true') {
    try {
      // 从设置中获取执行间隔时间
      const authorizationSetting = await Setting.findOne({
        key: 'authorization',
      });
      if (!authorizationSetting) {
        console.error('未找到授权收益间隔时间设置');
        return;
      }

      const intervalHours = parseInt(authorizationSetting.value);
      if (isNaN(intervalHours) || intervalHours <= 0) {
        console.error('授权收益间隔时间设置无效');
        return;
      }

      // 使用设置的小时数创建cron表达式
      // 测试用 - 每分钟执行一次
      // const cronExpression = `* * * * *`;
      // 正式用 - 每x小时执行一次
      const cronExpression = `0 */${intervalHours} * * *`;

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
      console.log(`- 授权用户收益生成：每${intervalHours}小时执行一次`);
    } catch (error) {
      console.error('启动定时任务时发生错误:', error);
    }
  } else {
    console.log('开发环境下，定时任务未启动');
  }
};
