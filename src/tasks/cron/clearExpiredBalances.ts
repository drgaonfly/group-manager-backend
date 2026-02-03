import Bot from '../../models/bot';
import BotUserConfig from '../../models/botUserConfig';

/**
 * 检查所有机器人的每月清零日期是否匹配当前日期
 * 如果匹配，则将该机器人对应的所有用户配置的 usdt_balance 清零
 */
export async function clearExpiredBalances() {
  try {
    console.log('[clearExpiredBalances] 开始检查每月余额清零任务...');

    const now = new Date();
    const currentDay = now.getDate(); // 获取当前是几号（1-31）

    // 查询所有设置了每月清零日期且等于当前日期的机器人
    const botsToClear = await Bot.find({
      balanceClearedAt: currentDay, // balanceClearedAt 现在存储的是每月几号（1-31）
      isOnline: true, // 只处理在线的机器人
    });

    console.log(
      `[clearExpiredBalances] 今天是${currentDay}号，查询到 ${botsToClear.length} 个需要清零余额的机器人`,
    );

    for (const bot of botsToClear) {
      console.log(
        `[clearExpiredBalances] 处理机器人 ${bot.botName} (${bot._id}) 的每月${currentDay}号余额清零任务`,
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

    console.log('[clearExpiredBalances] 每月余额清零任务处理完成');
  } catch (error) {
    console.error('[clearExpiredBalances] 处理每月余额清零时出错:', error);
  }
}
