import { MyContext } from '../../../types';
import { SpeechStatisticService } from '../../../../services/speechStatisticService';
import { InlineKeyboard } from 'grammy';
import { PAGE_SIZE, formatUserDisplay } from './constants';

/**
 * 周期配置
 */
export const PERIOD_CONFIG = {
  day: {
    label: '今日',
    emptyMessage: '📊 今日暂无发言记录',
    callbackPrefix: 'speech_day',
  },
  week: {
    label: '本周',
    emptyMessage: '📊 本周暂无发言记录',
    callbackPrefix: 'speech_week',
  },
  month: {
    label: '本月',
    emptyMessage: '📊 本月暂无发言记录',
    callbackPrefix: 'speech_month',
  },
} as const;

/**
 * 处理发言统计的通用函数
 */
export const handleSpeechStatistics = async (
  ctx: MyContext,
  period: 'day' | 'week' | 'month',
) => {
  if (!ctx.currentGroup) {
    await ctx.reply('❌ 此命令只能在群组中使用');
    return;
  }

  const config = PERIOD_CONFIG[period];

  // 获取分页统计数据
  const stats = await SpeechStatisticService.getGroupSpeechStatisticsPaginated(
    ctx.currentGroup._id,
    period,
    1,
    PAGE_SIZE,
  );

  if (!stats || stats.statistics.length === 0) {
    await ctx.reply(config.emptyMessage);
    return;
  }

  // 获取总活跃人数
  const fullStats = await SpeechStatisticService.getGroupSpeechStatistics(
    ctx.currentGroup._id,
    period,
  );
  const totalUsers = fullStats?.statistics.length || 0;

  // 构建消息
  const message = formatStatisticsMessage(stats, config.label, totalUsers);

  // 构建键盘
  const keyboard = new InlineKeyboard();
  if (stats.hasNextPage) {
    keyboard.text(
      '➡️ 下一页',
      `${config.callbackPrefix}_page_${stats.currentPage + 1}`,
    );
  }

  await ctx.reply(message, {
    reply_markup: keyboard,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
};

/**
 * 格式化统计消息
 */
const formatStatisticsMessage = (
  stats: any,
  periodLabel: string,
  totalUsers: number,
): string => {
  let message = [
    `${periodLabel}总发言：${stats.totalMessages} 条; ${periodLabel}活跃人数：${totalUsers} 人`,
    '',
    `${periodLabel}发言达人榜如下：`,
    '',
  ].join('\n');

  stats.statistics.forEach((stat: any, index: number) => {
    const userDisplay = formatUserDisplay(stat.displayName, stat.botUserName);
    message += `${index + 1}、${userDisplay} ${stat.messageCount}\n`;
  });

  return message;
};
