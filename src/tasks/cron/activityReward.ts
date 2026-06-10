import mongoose from 'mongoose';
import Bot from '../../models/bot';
import BotMessage from '../../models/botMessage';
import BotUserConfig from '../../models/botUserConfig';

type Cycle = 'daily' | 'weekly' | 'monthly';

/**
 * 计算指定周期的统计窗口（已结束的上一个周期）
 */
function getPreviousCycleRange(cycle: Cycle): {
  startDate: Date;
  endDate: Date;
  label: string;
} {
  const now = new Date();

  if (cycle === 'daily') {
    // 昨天 00:00:00 ~ 23:59:59
    const endDate = new Date(now);
    endDate.setHours(0, 0, 0, 0);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 1);
    const label = startDate.toLocaleDateString('zh-CN');
    return { startDate, endDate, label };
  }

  if (cycle === 'weekly') {
    // 上周一 00:00:00 ~ 本周一 00:00:00
    const thisMondayStart = new Date(now);
    const day = thisMondayStart.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    thisMondayStart.setDate(thisMondayStart.getDate() + diff);
    thisMondayStart.setHours(0, 0, 0, 0);

    const endDate = new Date(thisMondayStart);
    const startDate = new Date(thisMondayStart);
    startDate.setDate(startDate.getDate() - 7);
    const label = `${startDate.toLocaleDateString('zh-CN')} ~ ${new Date(
      endDate.getTime() - 1,
    ).toLocaleDateString('zh-CN')}`;
    return { startDate, endDate, label };
  }

  // monthly：上个自然月
  const endDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const startDate = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1,
    0,
    0,
    0,
    0,
  );
  const label = startDate.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
  });
  return { startDate, endDate, label };
}

/**
 * 判断当前时间是否是指定周期的结算时间点
 * daily：每天 00:00
 * weekly：每周一 00:00
 * monthly：每月 1 日 00:00
 */
function isSettlementTime(cycle: Cycle): boolean {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  // 只在 00:00（整点）执行，给 cron 任务 ±1 分钟的窗口
  if (hour !== 0 || minute > 1) return false;

  if (cycle === 'daily') return true;
  if (cycle === 'weekly') return now.getDay() === 1; // 周一
  if (cycle === 'monthly') return now.getDate() === 1; // 每月 1 日
  return false;
}

/**
 * 为指定 bot 查出活跃排行榜，并给前 N 名发放积分
 */
async function rewardActiveSpeakers(bot: any): Promise<void> {
  const {
    _id: botId,
    botName,
    activityRewardCycle,
    activityRewardTopN,
    activityRewardPoints,
    minSpeechLength,
    allowPureNumberSpeech,
    groups,
  } = bot;

  const cycle: Cycle = activityRewardCycle || 'daily';
  const topN: number = activityRewardTopN || 3;
  const rewardPoints: number = activityRewardPoints || 10;

  const { startDate, endDate, label } = getPreviousCycleRange(cycle);

  console.log(
    `[activityReward] 机器人「${botName}」(${botId}) — 周期:${cycle}, 结算区间:${label}, 前${topN}名, 每人${rewardPoints}积分`,
  );

  if (!groups || groups.length === 0) {
    console.log(`[activityReward] 机器人「${botName}」无关联群组，跳过`);
    return;
  }

  // 构建消息过滤条件（沿用 speechStatisticService 的逻辑）
  const matchConditions: any = {
    bot: botId,
    group: { $in: groups },
    createdAt: { $gte: startDate, $lt: endDate },
    $expr: {
      $gte: [
        { $strLenCP: { $ifNull: ['$content', ''] } },
        minSpeechLength ?? 1,
      ],
    },
  };

  if (!allowPureNumberSpeech) {
    matchConditions.content = { $not: /^\d+$/ };
  }

  // 聚合：按 botUser 统计发言总数，取前 N 名
  const topSpeakers = await BotMessage.aggregate([
    { $match: matchConditions },
    { $group: { _id: '$botUser', messageCount: { $sum: 1 } } },
    { $sort: { messageCount: -1 } },
    { $limit: topN },
  ]);

  if (topSpeakers.length === 0) {
    console.log(
      `[activityReward] 机器人「${botName}」本周期无有效发言，跳过奖励`,
    );
    return;
  }

  const winnerIds = topSpeakers.map((s) => s._id).filter(Boolean);

  // 批量为获奖用户增加积分
  const result = await BotUserConfig.updateMany(
    { bot: botId, botUser: { $in: winnerIds } },
    { $inc: { usdt_balance: rewardPoints } },
  );

  console.log(
    `[activityReward] 机器人「${botName}」奖励完成 — 共 ${result.modifiedCount} 名用户各获得 ${rewardPoints} 积分`,
  );

  // 打印获奖名单（便于日志追溯）
  topSpeakers.forEach((s, idx) => {
    console.log(
      `  #${idx + 1} botUser:${s._id}  发言数:${
        s.messageCount
      }  +${rewardPoints}积分`,
    );
  });
}

/**
 * 主入口：扫描所有启用了活跃奖励且处于结算时间点的机器人并发放奖励
 */
export async function processActivityRewards(): Promise<void> {
  try {
    console.log('[activityReward] 开始检查活跃奖励任务...');

    // 查询所有已启用活跃奖励的在线机器人
    const bots = await Bot.find({
      canSpeechStatic: true,
      enableActivityReward: true,
      isOnline: true,
    }).select(
      '_id botName activityRewardCycle activityRewardTopN activityRewardPoints minSpeechLength allowPureNumberSpeech groups',
    );

    console.log(
      `[activityReward] 共找到 ${bots.length} 个启用活跃奖励的机器人`,
    );

    for (const bot of bots) {
      const cycle: Cycle = (bot as any).activityRewardCycle || 'daily';

      if (!isSettlementTime(cycle)) {
        // 当前时间不是该周期的结算点，跳过
        continue;
      }

      try {
        await rewardActiveSpeakers(bot);
      } catch (err) {
        console.error(
          `[activityReward] 机器人「${(bot as any).botName}」奖励处理失败:`,
          err,
        );
      }
    }

    console.log('[activityReward] 活跃奖励任务处理完成');
  } catch (error) {
    console.error('[activityReward] 活跃奖励任务执行出错:', error);
  }
}
