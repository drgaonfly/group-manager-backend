import { Composer } from 'grammy';
import createDebug from 'debug';
import { MyContext } from '../../../types';
import { SpeechStatisticService } from '../../../../services/speechStatisticService';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';
import { InlineKeyboard } from 'grammy';
import { PAGE_SIZE, formatUserDisplay } from './constants';

const debug = createDebug('bot:speech:month');

const speechPerMonthCommand = new Composer<MyContext>();

speechPerMonthCommand.hears(/月发言|monthly/, checkGroup, async (ctx) => {
  try {
    debug('Monthly speech statistics requested');

    if (!ctx.currentGroup) {
      await ctx.reply('❌ 此命令只能在群组中使用');
      return;
    }

    const stats =
      await SpeechStatisticService.getGroupSpeechStatisticsPaginated(
        ctx.currentGroup._id,
        'month',
        1,
        PAGE_SIZE,
      );

    if (!stats || stats.statistics.length === 0) {
      await ctx.reply('📊 本月暂无发言记录');
      return;
    }

    // 获取总活跃人数
    const fullStats = await SpeechStatisticService.getGroupSpeechStatistics(
      ctx.currentGroup._id,
      'month',
    );
    const totalUsers = fullStats?.statistics.length || 0;

    let message = [
      `本月总发言：${stats.totalMessages} 条; 本月活跃人数：${totalUsers} 人`,
      '',
      `本月发言达人榜如下`,
      '',
    ].join('\n');

    stats.statistics.forEach((stat, index) => {
      const userDisplay = formatUserDisplay(stat.displayName, stat.botUserName);
      message += `${index + 1}、${userDisplay} ${stat.messageCount}\n`;
    });

    const keyboard = new InlineKeyboard();
    if (stats.hasNextPage) {
      keyboard.text('➡️ 下一页', `speech_month_page_${stats.currentPage + 1}`);
    }

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  } catch (error) {
    debug('Error in monthly speech statistics:', error);
    await ctx.reply('❌ 获取统计数据失败');
  }
});

export default speechPerMonthCommand;
