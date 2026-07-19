import { Middleware } from 'grammy';
import { MyContext } from '../types';
import { PermissionChecker } from '../utils/permissionChecker';
import SpeechConfig from '../../models/speechConfig';
import SpeechRewardLog from '../../models/speechRewardLog';
import BotUserConfig from '../../models/botUserConfig';
import { getPeriodStart } from '../../utils/dateHelper';
import createDebug from 'debug';

const debug = createDebug('bot:speechReward');

/**
 * 尝试发放发言奖励
 */
async function tryGrantReward(
  botId: any,
  botUserId: any,
  groupId: any,
): Promise<number> {
  try {
    // 查询群级配置
    const config = await SpeechConfig.findOne({
      bot: botId,
      group: groupId,
    }).lean();
    if (!config?.enableSpeechReward) {
      return 0;
    }

    const { speechRewardCycle, speechRewardPoints, speechRewardMaxTimes } =
      config;
    const periodStart = getPeriodStart(speechRewardCycle);

    // 确保当前周期的 log 记录存在
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

    // 原子递增：只有 rewardedTimes < maxTimes 时才更新
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
      debug(`botUser ${botUserId} 周期内已达上限 ${speechRewardMaxTimes} 次`);
      return 0;
    }

    // 给用户加积分
    await BotUserConfig.updateOne(
      { bot: botId, botUser: botUserId },
      { $inc: { usdt_balance: speechRewardPoints } },
    );

    debug(
      `botUser ${botUserId} 获得 ${speechRewardPoints} 积分，` +
        `本周期已奖励 ${updated.rewardedTimes}/${speechRewardMaxTimes} 次`,
    );

    return speechRewardPoints;
  } catch (err) {
    debug('发放奖励失败:', err);
    return 0;
  }
}

/**
 * 发言奖励中间件
 *
 * 功能：在用户每次发言时，根据群组配置发放即时奖励
 * 触发条件：
 * 1. 群组消息（非回调查询）
 * 2. 有权限使用发言统计功能
 * 3. 群组已启用发言奖励
 */
export const speechRewardHandler: Middleware<MyContext> = async (ctx, next) => {
  // 只处理群组消息，跳过回调查询
  if (ctx.callbackQuery || !ctx.message || !ctx.currentGroup) {
    return next();
  }

  try {
    // 检查权限
    const canUseSpeechStatic = PermissionChecker.canUseSpeechStatic(
      ctx.currentProxyUser,
      ctx.currentBot,
    );

    if (!canUseSpeechStatic) {
      return next();
    }

    // 异步发放奖励，不阻塞消息流程
    tryGrantReward(
      ctx.currentBot._id,
      ctx.currentBotUser._id,
      ctx.currentGroup._id,
    ).catch((err) => {
      debug('发放奖励异常:', err);
    });
  } catch (err) {
    debug('中间件异常:', err);
  }

  await next();
};
