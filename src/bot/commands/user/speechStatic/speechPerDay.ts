import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';
import { checkSpeechStatic } from '../../../middlewares/checkSpeechStatic';
import { handleSpeechStatistics } from './helpers';
import createDebug from 'debug';

const debug = createDebug('bot:speech:day');

const speechPerDayCommand = new Composer<MyContext>();

speechPerDayCommand.hears(
  /日发言|daily/,
  checkGroup,
  checkSpeechStatic,
  async (ctx) => {
    try {
      debug('Daily speech statistics requested');
      await handleSpeechStatistics(ctx, 'day');
    } catch (error) {
      debug('Error in daily speech statistics:', error);
      await ctx.reply('❌ 获取统计数据失败');
    }
  },
);

export default speechPerDayCommand;
