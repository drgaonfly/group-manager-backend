import BotMessage from '../../models/botMessage';
import dayjs from 'dayjs';

/**
 * 清理超过本月的 BotMessage 记录
 *
 * 功能：删除创建时间早于本月开始的所有 BotMessage 记录
 * 运行时机：每天凌晨 2 点执行一次
 * 保留数据：仅保留当月数据（足够支持日/周/月统计）
 */
export async function cleanupOldBotMessages(): Promise<void> {
  try {
    console.log('[cleanupBotMessages] 开始清理旧的 BotMessage 记录...');

    const currentMonthStart = dayjs().startOf('month').toDate();

    const result = await BotMessage.deleteMany({
      createdAt: { $lt: currentMonthStart },
    });

    if (result.deletedCount > 0) {
      console.log(
        `[cleanupBotMessages] 成功清理 ${
          result.deletedCount
        } 条记录（${currentMonthStart.toISOString()} 之前）`,
      );
    } else {
      console.log('[cleanupBotMessages] 无需清理，没有找到旧记录');
    }
  } catch (error) {
    console.error('[cleanupBotMessages] 清理任务执行出错:', error);
  }
}
