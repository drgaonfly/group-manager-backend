import { Composer } from 'grammy';
import createDebug from 'debug';
import { MyContext } from '../../../types';
import { SpeechStatisticService } from '../../../../services/speechStatisticService';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';
import { InlineKeyboard } from 'grammy';
import { PAGE_SIZE, formatUserDisplay } from './constants';

const debug = createDebug('bot:speech:week');

const speechPerWeekCommand = new Composer<MyContext>();

speechPerWeekCommand.hears(/周发言|weekly/, checkGroup, async (ctx) => {
  try {
    debug('Weekly speech statistics requested');

    if (!ctx.currentGroup) {
      await ctx.reply('❌ 此命令只能在群组中使用');
      return;
    }

    const stats =
      await SpeechStatisticService.getGroupSpeechStatisticsPaginated(
        ctx.currentGroup._id,
        'week',
        1,
        PAGE_SIZE,
      );

    if (!stats || stats.statistics.length === 0) {
      await ctx.reply('📊 本周暂无发言记录');
      return;
    }

    // 获取总活跃人数
    const fullStats = await SpeechStatisticService.getGroupSpeechStatistics(
      ctx.currentGroup._id,
      'week',
    );
    const totalUsers = fullStats?.statistics.length || 0;

    let message = [
      `本周总发言：${stats.totalMessages} 条; 本周活跃人数：${totalUsers} 人`,
      '',
      `本周发言达人榜如下：`,
      '',
    ].join('\n');

    stats.statistics.forEach((stat, index) => {
      const userDisplay = formatUserDisplay(stat.displayName, stat.botUserName);
      message += `${index + 1}、${userDisplay} ${stat.messageCount}\n`;
    });

    const keyboard = new InlineKeyboard();
    if (stats.hasNextPage) {
      keyboard.text('➡️ 下一页', `speech_week_page_${stats.currentPage + 1}`);
    }

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  } catch (error) {
    debug('Error in weekly speech statistics:', error);
    await ctx.reply('❌ 获取统计数据失败');
  }
});

export default speechPerWeekCommand;
