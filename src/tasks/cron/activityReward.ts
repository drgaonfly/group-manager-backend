import SpeechConfig from '../../models/speechConfig';
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
    const endDate = new Date(now);
    endDate.setHours(0, 0, 0, 0);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 1);
    const label = startDate.toLocaleDateString('zh-CN');
    return { startDate, endDate, label };
  }

  if (cycle === 'weekly') {
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

  // monthly
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
 */
function isSettlementTime(cycle: Cycle): boolean {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  if (hour !== 0 || minute > 1) return false;

  if (cycle === 'daily') return true;
  if (cycle === 'weekly') return now.getDay() === 1;
  if (cycle === 'monthly') return now.getDate() === 1;
  return false;
}

/**
 * 为单条 SpeechConfig 执行排行榜奖励结算
 */
async function settleActivityReward(config: any): Promise<void> {
  const {
    bot,
    group,
    activityRewardCycle,
    activityRewardTopN,
    activityRewardPoints,
    minSpeechLength,
    allowPureNumberSpeech,
  } = config;

  const botId = bot._id || bot;
  const botName = bot.botName || botId;
  const groupId = group?._id || group;
  const groupTitle = group?.title || groupId;
  const cycle: Cycle = activityRewardCycle || 'daily';
  const topN: number = activityRewardTopN || 3;
  const rewardPoints: number = activityRewardPoints || 10;

  const { startDate, endDate, label } = getPreviousCycleRange(cycle);

  console.log(
    `[activityReward] 机器人「${botName}」群组「${groupTitle}」— 周期:${cycle}, 结算区间:${label}, 前${topN}名, 每人${rewardPoints}积分`,
  );

  // 构建消息过滤条件（增加 group 过滤）
  const matchConditions: any = {
    bot: botId,
    group: groupId,
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
      `[activityReward] 机器人「${botName}」群组「${groupTitle}」本周期无有效发言，跳过奖励`,
    );
    return;
  }

  const winnerIds = topSpeakers.map((s) => s._id).filter(Boolean);

  const result = await BotUserConfig.updateMany(
    { bot: botId, botUser: { $in: winnerIds } },
    { $inc: { usdt_balance: rewardPoints } },
  );

  console.log(
    `[activityReward] 机器人「${botName}」群组「${groupTitle}」奖励完成 — 共 ${result.modifiedCount} 名用户各获得 ${rewardPoints} 积分`,
  );

  topSpeakers.forEach((s, idx) => {
    console.log(
      `  #${idx + 1} botUser:${s._id}  发言数:${
        s.messageCount
      }  +${rewardPoints}积分`,
    );
  });
}

/**
 * 主入口：扫描所有启用了排行榜奖励且处于结算时间点的 SpeechConfig
 */
export async function processActivityRewards(): Promise<void> {
  try {
    console.log('[activityReward] 开始检查活跃奖励任务...');

    const configs = await SpeechConfig.find({
      enableActivityReward: true,
    })
      .populate('bot', '_id botName isOnline')
      .populate('group', '_id title');

    console.log(
      `[activityReward] 共找到 ${configs.length} 个启用排行榜奖励的配置`,
    );

    for (const config of configs) {
      const botDoc = config.bot as any;

      // 跳过离线机器人
      if (botDoc?.isOnline === false) {
        continue;
      }

      const cycle: Cycle = config.activityRewardCycle || 'daily';

      if (!isSettlementTime(cycle)) {
        continue;
      }

      try {
        await settleActivityReward(config);
      } catch (err) {
        console.error(
          `[activityReward] 机器人「${
            botDoc?.botName || config.bot
          }」奖励处理失败:`,
          err,
        );
      }
    }

    console.log('[activityReward] 活跃奖励任务处理完成');
  } catch (error) {
    console.error('[activityReward] 活跃奖励任务执行出错:', error);
  }
}
