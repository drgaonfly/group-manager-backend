import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { SpeechStatisticService } from '../../../../services/speechStatisticService';
import { InlineKeyboard } from 'grammy';
import { PAGE_SIZE, formatUserDisplay } from './constants';
import createDebug from 'debug';

const debug = createDebug('bot:speech:pagination');

const paginationComposer = new Composer<MyContext>();

// 获取周期标签
const getPeriodLabels = (period: 'day' | 'week' | 'month') => {
  switch (period) {
    case 'day':
      return { title: '日发言', prefix: '今日' };
    case 'week':
      return { title: '周发言', prefix: '本周' };
    case 'month':
      return { title: '月发言', prefix: '本月' };
  }
};

// 格式化统计消息
const formatStatisticsMessage = (
  stats: any,
  period: 'day' | 'week' | 'month',
  totalUsers: number,
): string => {
  const labels = getPeriodLabels(period);

  let message = `${labels.title}\n`;
  message += `${labels.prefix}总发言：${stats.totalMessages} 条; ${labels.prefix}活跃人数：${totalUsers} 人，\n`;
  message += `${labels.prefix}发言达人榜如下：\n`;

  const startIndex = (stats.currentPage - 1) * PAGE_SIZE;
  stats.statistics.forEach((stat: any, index: number) => {
    const rank = startIndex + index + 1;
    const userDisplay = formatUserDisplay(stat.displayName, stat.botUserName);
    message += `${rank}、${userDisplay} ${stat.messageCount}\n`;
  });

  return message;
};

// 生成分页键盘
const createPaginationKeyboard = (
  prefix: string,
  currentPage: number,
  hasPrevPage: boolean,
  hasNextPage: boolean,
): InlineKeyboard => {
  const keyboard = new InlineKeyboard();
  if (hasPrevPage) {
    keyboard.text('⬅️ 上一页', `${prefix}_page_${currentPage - 1}`);
  }
  if (hasNextPage) {
    keyboard.text('➡️ 下一页', `${prefix}_page_${currentPage + 1}`);
  }
  return keyboard;
};

// 处理分页回调的通用函数
const handlePagination = async (
  ctx: MyContext,
  period: 'day' | 'week' | 'month',
  page: number,
  prefix: string,
) => {
  try {
    if (!ctx.currentGroup) {
      await ctx.answerCallbackQuery('❌ 此功能只能在群组中使用');
      return;
    }

    debug(
      `Fetching page ${page} for ${period} statistics, group: ${ctx.currentGroup._id}`,
    );

    const stats =
      await SpeechStatisticService.getGroupSpeechStatisticsPaginated(
        ctx.currentGroup._id,
        period,
        page,
        PAGE_SIZE,
      );

    if (!stats) {
      await ctx.answerCallbackQuery('❌ 获取数据失败');
      return;
    }

    if (stats.statistics.length === 0) {
      await ctx.answerCallbackQuery('❌ 该页没有数据');
      return;
    }

    // 获取总活跃人数（从完整统计中获取）
    const fullStats = await SpeechStatisticService.getGroupSpeechStatistics(
      ctx.currentGroup._id,
      period,
    );
    const totalUsers = fullStats?.statistics.length || 0;

    const message = formatStatisticsMessage(stats, period, totalUsers);
    const keyboard = createPaginationKeyboard(
      prefix,
      stats.currentPage,
      stats.hasPrevPage,
      stats.hasNextPage,
    );

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
    await ctx.answerCallbackQuery();
  } catch (error) {
    debug('Error in handlePagination:', error);
    await ctx.answerCallbackQuery('❌ 处理请求失败');
  }
};

// 日统计分页回调
paginationComposer.callbackQuery(/^speech_day_page_(\d+)$/, async (ctx) => {
  const match = ctx.callbackQuery.data.match(/^speech_day_page_(\d+)$/);
  const page = parseInt(match?.[1] || '1');
  debug(`Daily statistics page ${page} requested`);

  await handlePagination(ctx, 'day', page, 'speech_day');
});

// 周统计分页回调
paginationComposer.callbackQuery(/^speech_week_page_(\d+)$/, async (ctx) => {
  const match = ctx.callbackQuery.data.match(/^speech_week_page_(\d+)$/);
  const page = parseInt(match?.[1] || '1');
  debug(`Weekly statistics page ${page} requested`);

  await handlePagination(ctx, 'week', page, 'speech_week');
});

// 月统计分页回调
paginationComposer.callbackQuery(/^speech_month_page_(\d+)$/, async (ctx) => {
  const match = ctx.callbackQuery.data.match(/^speech_month_page_(\d+)$/);
  const page = parseInt(match?.[1] || '1');
  debug(`Monthly statistics page ${page} requested`);

  await handlePagination(ctx, 'month', page, 'speech_month');
});

export default paginationComposer;
