import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { SpeechStatisticService } from '../../../../services/speechStatisticService';
import { InlineKeyboard } from 'grammy';
import { PAGE_SIZE, formatUserDisplay } from './constants';
import { PERIOD_CONFIG } from './helpers';
import createDebug from 'debug';

const debug = createDebug('bot:speech:pagination');

const paginationComposer = new Composer<MyContext>();

/**
 * 处理分页回调的通用函数
 */
const handlePagination = async (
  ctx: MyContext,
  period: 'day' | 'week' | 'month',
  page: number,
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

    if (!stats || stats.statistics.length === 0) {
      await ctx.answerCallbackQuery('❌ 该页没有数据');
      return;
    }

    // 获取总活跃人数
    const fullStats = await SpeechStatisticService.getGroupSpeechStatistics(
      ctx.currentGroup._id,
      period,
    );
    const totalUsers = fullStats?.statistics.length || 0;

    // 构建消息
    const config = PERIOD_CONFIG[period];
    const message = formatStatisticsMessage(
      stats,
      config.label,
      totalUsers,
      page,
    );

    // 构建分页键盘
    const keyboard = createPaginationKeyboard(
      config.callbackPrefix,
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

/**
 * 格式化统计消息
 */
const formatStatisticsMessage = (
  stats: any,
  periodLabel: string,
  totalUsers: number,
  page: number,
): string => {
  let message = `${periodLabel}总发言：${stats.totalMessages} 条; ${periodLabel}活跃人数：${totalUsers} 人\n\n`;
  message += `${periodLabel}发言达人榜如下：\n\n`;

  const startIndex = (page - 1) * PAGE_SIZE;
  stats.statistics.forEach((stat: any, index: number) => {
    const rank = startIndex + index + 1;
    const userDisplay = formatUserDisplay(stat.displayName, stat.botUserName);
    message += `${rank}、${userDisplay} ${stat.messageCount}\n`;
  });

  return message;
};

/**
 * 生成分页键盘
 */
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

// 日统计分页回调
paginationComposer.callbackQuery(/^speech_day_page_(\d+)$/, async (ctx) => {
  const match = ctx.callbackQuery.data.match(/^speech_day_page_(\d+)$/);
  const page = parseInt(match?.[1] || '1');
  debug(`Daily statistics page ${page} requested`);
  await handlePagination(ctx, 'day', page);
});

// 周统计分页回调
paginationComposer.callbackQuery(/^speech_week_page_(\d+)$/, async (ctx) => {
  const match = ctx.callbackQuery.data.match(/^speech_week_page_(\d+)$/);
  const page = parseInt(match?.[1] || '1');
  debug(`Weekly statistics page ${page} requested`);
  await handlePagination(ctx, 'week', page);
});

// 月统计分页回调
paginationComposer.callbackQuery(/^speech_month_page_(\d+)$/, async (ctx) => {
  const match = ctx.callbackQuery.data.match(/^speech_month_page_(\d+)$/);
  const page = parseInt(match?.[1] || '1');
  debug(`Monthly statistics page ${page} requested`);
  await handlePagination(ctx, 'month', page);
});

export default paginationComposer;
