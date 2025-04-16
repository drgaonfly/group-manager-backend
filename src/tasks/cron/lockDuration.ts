import Activity from '../../models/activity';
import ReleaseRecord from '../../models/releaseRecord';
import { CronJob } from 'cron';
import { IActivity } from '../../models/activity';
import { Document } from 'mongoose';

interface ICustomer extends Document {
  _id: string;
  network: string;
  address: string;
}

interface IPopulatedActivity extends Omit<IActivity, 'customer'> {
  customer: ICustomer;
}

// 检查锁定时间并创建释放记录的函数
async function checkLockDurationAndCreateRelease(): Promise<void> {
  try {
    // 查找所有状态为 active 且已超过锁定时间的活动
    const expiredActivities = (await Activity.find({
      status: 'active',
      participateTime: {
        $lte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24小时前
      },
    }).populate('customer')) as IPopulatedActivity[];

    for (const activity of expiredActivities) {
      // 计算锁定到期时间
      const lockEndTime = new Date(activity.participateTime);
      lockEndTime.setHours(lockEndTime.getHours() + activity.lockDuration * 24);

      // 如果当前时间超过锁定结束时间
      if (new Date() >= lockEndTime) {
        // 更新活动状态
        activity.status = 'completed';
        await activity.save();

        // 创建释放记录
        await ReleaseRecord.create({
          user: activity.user,
          customer: activity?.customer?._id,
          activity: activity._id,
          chainName: activity.customer.network,
          walletAddress: activity.customer.address,
          applyTime: new Date(),
          status: 'pending',
          stakedUsdt: activity.usdtAmount,
          rewardEth: activity.ethProfit,
          lockDays: activity.lockDuration,
          releaseTime: activity.activityEndTime,
        });
      }
    }
  } catch (error) {
    console.error('检查锁定时间任务出错:', error);
  }
}

// 根据环境变量决定是否启动定时任务
const enableCron = process.env.LOCK_DURATION_CRON === 'true';

// 创建定时任务，每小时执行一次
const lockDurationJob = new CronJob(
  '0 * * * *', // 每小时执行一次
  checkLockDurationAndCreateRelease,
  null,
  enableCron, // 使用环境变量控制是否自动启动
  'Asia/Shanghai',
);

export default lockDurationJob;
