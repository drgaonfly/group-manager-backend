import cron from 'node-cron';
import { generateFlowingIncome } from '../controllers/incomeController';
import Setting from '../models/setting';
import { getSocketIO } from '../services/socket';

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

      // 创建一个函数来更新和发送倒计时
      let nextExecutionTime = calculateNextExecutionTime(intervalHours);

      // 立即发送一次初始倒计时
      emitCountdown(nextExecutionTime);

      // 每两秒更新倒计时
      setInterval(() => {
        emitCountdown(nextExecutionTime);
      }, 1000);

      // 创建定时任务
      cron.schedule(
        cronExpression,
        async () => {
          try {
            await generateFlowingIncome();
            // 更新下次执行时间
            nextExecutionTime = calculateNextExecutionTime(intervalHours);
            // 立即发送更新后的倒计时
            emitCountdown(nextExecutionTime);
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

// 计算下次执行时间
function calculateNextExecutionTime(intervalHours: number): Date {
  const now = new Date();
  const hour = now.getHours();
  const nextHour = Math.ceil(hour / intervalHours) * intervalHours;

  const nextTime = new Date(now);
  nextTime.setHours(nextHour, 0, 0, 0);

  // 如果计算出的时间已经过去，则加上间隔时间
  if (nextTime <= now) {
    nextTime.setHours(nextTime.getHours() + intervalHours);
  }

  return nextTime;
}

// 发送倒计时信息
function emitCountdown(nextExecutionTime: Date): void {
  try {
    const io = getSocketIO();
    if (!io) {
      console.log('Socket.IO 未初始化，无法发送倒计时');
      return;
    }

    const now = new Date();
    const timeRemaining = nextExecutionTime.getTime() - now.getTime();

    if (timeRemaining <= 0) return;

    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutes = Math.floor(
      (timeRemaining % (1000 * 60 * 60)) / (1000 * 60),
    );
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

    io.emit('income_countdown', {
      nextExecutionTime: nextExecutionTime.toISOString(),
      timeRemaining: Math.floor(timeRemaining / 1000),
      formatted: `${hours}:${minutes}:${seconds}`,
      hours,
      minutes,
      seconds,
    });

    console.log(`已发送倒计时信息: ${hours}小时${minutes}分钟${seconds}秒`);
  } catch (error) {
    console.error('发送倒计时信息时发生错误:', error);
  }
}
