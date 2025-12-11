import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { SpeechStatisticService } from '../../../../services/speechStatisticService';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';
import { InlineKeyboard } from 'grammy';
import { PAGE_SIZE, formatUserDisplay } from './constants';

import createDebug from 'debug';
const debug = createDebug('bot:speech:day');

const speechPerDayCommand = new Composer<MyContext>();

speechPerDayCommand.hears(/日发言|daily/, checkGroup, async (ctx) => {
  try {
    debug('Daily speech statistics requested');

    if (!ctx.currentGroup) {
      await ctx.reply('❌ 此命令只能在群组中使用');
      return;
    }

    const stats =
      await SpeechStatisticService.getGroupSpeechStatisticsPaginated(
        ctx.currentGroup._id,
        'day',
        1,
        PAGE_SIZE,
      );

    if (!stats || stats.statistics.length === 0) {
      await ctx.reply('📊 今日暂无发言记录');
      return;
    }

    // 获取总活跃人数
    const fullStats = await SpeechStatisticService.getGroupSpeechStatistics(
      ctx.currentGroup._id,
      'day',
    );
    const totalUsers = fullStats?.statistics.length || 0;

    let message = [
      `今日总发言：${stats.totalMessages} 条; 今日活跃人数：${totalUsers} 人`,
      '',
      `今日发言达人榜如下: `,
      '',
    ].join('\n');

    stats.statistics.forEach((stat, index) => {
      const userDisplay = formatUserDisplay(stat.displayName, stat.botUserName);
      message += `${index + 1}、${userDisplay} ${stat.messageCount}\n`;
    });

    const keyboard = new InlineKeyboard();
    if (stats.hasNextPage) {
      keyboard.text('➡️ 下一页', `speech_day_page_${stats.currentPage + 1}`);
    }

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  } catch (error) {
    debug('Error in daily speech statistics:', error);
    await ctx.reply('❌ 获取统计数据失败');
  }
});

export default speechPerDayCommand;
