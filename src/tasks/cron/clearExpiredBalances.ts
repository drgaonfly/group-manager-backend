import Bot from '../../models/bot';
import BotUserConfig from '../../models/botUserConfig';

/**
 * 检查所有机器人的 balanceClearedAt 是否到期
 * 如果到期，则将该机器人对应的所有用户配置的 usdt_balance 清零
 */
export async function clearExpiredBalances() {
  try {
    console.log('[clearExpiredBalances] 开始检查过期余额清零任务...');

    const now = new Date();

    // 查询所有 balanceClearedAt 已到期的机器人
    const expiredBots = await Bot.find({
      balanceClearedAt: { $lte: now },
      isOnline: true, // 只处理在线的机器人
    });

    console.log(
      `[clearExpiredBalances] 查询到 ${expiredBots.length} 个余额清零时间已到期的机器人`,
    );

    for (const bot of expiredBots) {
      console.log(
        `[clearExpiredBalances] 处理机器人 ${bot.botName} (${bot._id}) 的余额清零任务`,
      );

      // 将该机器人下所有用户的 usdt_balance 清零
      const updateResult = await BotUserConfig.updateMany(
        { bot: bot._id },
        { $set: { usdt_balance: 0 } },
      );

      console.log(
        `[clearExpiredBalances] 机器人 ${bot.botName} 的 ${updateResult.modifiedCount} 个用户余额已清零`,
      );
    }

    console.log('[clearExpiredBalances] 过期余额清零任务处理完成');
  } catch (error) {
    console.error('[clearExpiredBalances] 处理过期余额清零时出错:', error);
  }
}
