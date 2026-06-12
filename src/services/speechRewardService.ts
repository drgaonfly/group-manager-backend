import SpeechConfig from '../models/speechConfig';
import SpeechRewardLog from '../models/speechRewardLog';
import BotUserConfig from '../models/botUserConfig';
import { SpeechRewardCycle } from '../models/speechConfig';
import createDebug from 'debug';

const debug = createDebug('bot:speechReward');

/**
 * 计算当前周期的起始时间（UTC+8 北京时间语义）
 */
function getPeriodStart(cycle: SpeechRewardCycle): Date {
  const now = new Date();

  if (cycle === 'daily') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  if (cycle === 'weekly') {
    const d = new Date(now);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // 对齐到周一
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // monthly
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * 尝试为用户发放一次即时发言奖励。
 *
 * 全程只做两次 DB 操作，无竞态窗口：
 *
 * 1. findOneAndUpdate（upsert + 条件 $inc）：
 *    - 若本周期 log 不存在 → 插入，rewardedTimes 从 0 → 1
 *    - 若 rewardedTimes < maxTimes → 原子 +1
 *    - 若 rewardedTimes >= maxTimes → 条件不满足，返回 null（不修改）
 * 2. 只有第一步成功（返回非 null）才给 BotUserConfig 加积分
 *
 * @param botId   机器人 ID
 * @param botUserId 用户 ID
 * @param groupId 群组 ID（用于按群查配置）
 * @returns 实际发放的积分数（0 表示未发放）
 */
export async function tryGrantSpeechReward(
  botId: any,
  botUserId: any,
  groupId?: any,
): Promise<number> {
  try {
    // 优先查群级配置，没有则降级到 bot 级配置（向后兼容）
    let config = groupId
      ? await SpeechConfig.findOne({ bot: botId, group: groupId }).lean()
      : null;

    if (!config) {
      config = await SpeechConfig.findOne({ bot: botId }).lean();
    }

    if (!config?.enableSpeechReward) {
      return 0;
    }

    const { speechRewardCycle, speechRewardPoints, speechRewardMaxTimes } =
      config;

    const periodStart = getPeriodStart(speechRewardCycle);

    // 先确保当前周期的 log 记录存在（upsert），避免后续原子更新时找不到文档
    await SpeechRewardLog.updateOne(
      { bot: botId, botUser: botUserId, periodStart },
      {
        $setOnInsert: {
          bot: botId,
          botUser: botUserId,
          cycle: speechRewardCycle,
          periodStart,
          rewardedTimes: 0,
          rewardedPoints: 0,
        },
      },
      { upsert: true },
    );

    // 原子递增：只有 rewardedTimes < maxTimes 时才更新，更新成功返回新文档，否则返回 null
    const updated = await SpeechRewardLog.findOneAndUpdate(
      {
        bot: botId,
        botUser: botUserId,
        periodStart,
        rewardedTimes: { $lt: speechRewardMaxTimes },
      },
      {
        $inc: {
          rewardedTimes: 1,
          rewardedPoints: speechRewardPoints,
        },
      },
      { new: true },
    );

    if (!updated) {
      // 条件不满足：本周期已达上限
      debug(
        `[speechReward] botUser ${botUserId} 周期内已达上限 ${speechRewardMaxTimes} 次，跳过`,
      );
      return 0;
    }

    // 给用户加积分
    await BotUserConfig.updateOne(
      { bot: botId, botUser: botUserId },
      { $inc: { usdt_balance: speechRewardPoints } },
    );

    debug(
      `[speechReward] botUser ${botUserId} 获得 ${speechRewardPoints} 积分` +
        `，本周期已奖励 ${updated.rewardedTimes}/${speechRewardMaxTimes} 次`,
    );

    return speechRewardPoints;
  } catch (err) {
    // 奖励失败不应阻塞消息流程
    debug('[speechReward] 发放即时奖励时出错:', err);
    return 0;
  }
}
