import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { checkSpeechStatic } from '../../../middlewares/checkSpeechStatic';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';
import { handleSpeechStatistics } from './helpers';
import createDebug from 'debug';

const debug = createDebug('bot:speech:month');

const speechPerMonthCommand = new Composer<MyContext>();

speechPerMonthCommand.hears(
  /月发言|monthly/,
  checkGroup,
  checkSpeechStatic,
  async (ctx) => {
    try {
      debug('Monthly speech statistics requested');
      await handleSpeechStatistics(ctx, 'month');
    } catch (error) {
      debug('Error in monthly speech statistics:', error);
      await ctx.reply('❌ 获取统计数据失败');
    }
  },
);

export default speechPerMonthCommand;
