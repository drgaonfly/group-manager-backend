import CheckinHistory from '../../../../models/checkinHistory';

/**
 * 检查用户今天是否已经签到过
 * @param botUserId 用户ID
 * @param type 签到类型
 * @returns 是否已经签到
 */
export const hasCheckedInToday = async (
  botId: string,
  botUserId: string,
  groupId: string,
  type: string,
): Promise<boolean> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existingCheckin = await CheckinHistory.findOne({
    bot: botId,
    botUser: botUserId,
    type,
    group: groupId,
    createdAt: {
      $gte: today,
      $lt: tomorrow,
    },
  });

  return !!existingCheckin;
};

/**
 * 检查用户是否是首次签到
 * @param botUserId 用户ID
 * @returns 是否首次签到
 */
export const isFirstTimeCheckin = async (
  botUserId: string,
): Promise<boolean> => {
  const existingCheckin = await CheckinHistory.findOne({
    botUser: botUserId,
  });

  return !existingCheckin;
};

/**
 * 计算用户连续签到天数
 * @param botId 机器人ID
 * @param botUserId 用户ID
 * @param groupId 群组ID
 * @returns 连续签到天数
 */
export const getStreakDays = async (
  botId: string,
  botUserId: string,
  groupId: string,
): Promise<number> => {
  // 获取用户最近一次签到记录
  const lastCheckin = await CheckinHistory.findOne({
    bot: botId,
    botUser: botUserId,
    group: groupId,
    type: 'daily',
  })
    .sort({ createdAt: -1 })
    .exec();

  if (!lastCheckin) {
    return 0; // 从未签到过
  }

  const lastCheckinDate = new Date(lastCheckin.createdAt);
  const today = new Date();

  // 设置时间为 00:00:00 进行比较
  lastCheckinDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  // 计算天数差
  const timeDiff = today.getTime() - lastCheckinDate.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));

  // 如果昨天签到过，连续天数+1；否则断签，从1开始
  if (daysDiff === 1) {
    return lastCheckin.streakDays + 1;
  } else if (daysDiff === 0) {
    // 今天已经签到过，返回当前连续天数
    return lastCheckin.streakDays;
  } else {
    // 断签，重新开始
    return 1;
  }
};

/**
 * 根据连续天数和规则计算倍率
 * @param streakDays 连续签到天数
 * @param streakCycles 周期配置
 * @param maxMultiplier 最高倍率限制
 * @returns 实际倍率
 */
export const calculateMultiplier = (
  streakDays: number,
  streakCycles: Array<{ days: number; multiplier: number }>,
  maxMultiplier: number,
): number => {
  // 按天数降序排序，找到第一个满足条件的周期
  const sortedCycles = [...streakCycles].sort((a, b) => b.days - a.days);

  for (const cycle of sortedCycles) {
    if (streakDays >= cycle.days) {
      return Math.min(cycle.multiplier, maxMultiplier);
    }
  }

  // 没有匹配的周期，返回1倍
  return 1;
};
