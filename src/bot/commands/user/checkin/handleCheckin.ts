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
