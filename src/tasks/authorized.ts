import cron from 'node-cron';
import { generateFlowingIncome } from '../controllers/incomeController';
import Setting from '../models/setting';
// import { getSocketIO } from '../services/socket';

// 启动定时任务
export const authorized = async (): Promise<void> => {
  if (process.env.CRON_AUTHORIZED === 'true') {
    try {
      // 从设置中获取执行间隔时间（用于显示倒计时和计算用户收益）
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

      // 修改定时任务为每小时运行一次，这样可以更精确地检查用户参与时间
      const cronExpression = `0 * * * *`;

      // 创建一个函数来更新和发送倒计时
      // let nextExecutionTime = calculateNextExecutionTime(1); // 固定为1小时，因为现在每小时检查一次

      // 立即发送一次初始倒计时
      // emitCountdown(nextExecutionTime);

      // // 每秒更新倒计时
      // setInterval(() => {
      //   emitCountdown(nextExecutionTime);
      // }, 1000);

      // 创建定时任务
      cron.schedule(
        cronExpression,
        async () => {
          try {
            await generateFlowingIncome();
            // 更新下次执行时间
            // nextExecutionTime = calculateNextExecutionTime(1);
            // 立即发送更新后的倒计时
            // emitCountdown(nextExecutionTime);
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
      console.log(`- 每个用户按照参与时间 + ${intervalHours}小时间隔生成收益`);
    } catch (error) {
      console.error('启动定时任务时发生错误:', error);
    }
  } else {
    console.log('开发环境下，定时任务未启动');
  }
};

// 计算下次授权执行时间 (固定为每小时)
// function calculateNextExecutionTime(_intervalHours: number): Date {
//   const now = new Date();
//   const nextTime = new Date(now);

//   // 设置为下一个整点小时
//   nextTime.setHours(now.getHours() + 1, 0, 0, 0);

//   return nextTime;
// }

// 发送倒计时信息
/*
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
*/
