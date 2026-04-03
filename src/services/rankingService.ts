import { Types } from 'mongoose';
import BotUserConfig from '../models/botUserConfig';

/**
 * 获取用户在特定群组内的积分排名
 * @param botId 机器人 ID
 * @param usdtBalance 当前用户的积分余额
 * @param groupBotUserIds 群组内的所有成员 ID 列表
 * @returns 排名数字（从 1 开始）
 */
export const getGroupUserRanking = async (
  botId: string | Types.ObjectId,
  usdtBalance: number,
  groupBotUserIds?: (string | Types.ObjectId)[],
): Promise<number | undefined> => {
  if (!groupBotUserIds || groupBotUserIds.length === 0) {
    return undefined;
  }

  const rank = await BotUserConfig.countDocuments({
    bot: botId,
    botUser: { $in: groupBotUserIds },
    usdt_balance: { $gt: usdtBalance },
  });

  return rank + 1;
};
