import { Composer } from 'grammy';
import createDebug from 'debug';
import { MyContext } from '../../../types';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';
import { checkSpeechStatic } from '../../../middlewares/checkSpeechStatic';
import { handleSpeechStatistics } from './helpers';

const debug = createDebug('bot:speech:week');

const speechPerWeekCommand = new Composer<MyContext>();

speechPerWeekCommand.hears(
  /周发言|weekly/,
  checkGroup,
  checkSpeechStatic,
  async (ctx) => {
    try {
      debug('Weekly speech statistics requested');
      await handleSpeechStatistics(ctx, 'week');
    } catch (error) {
      debug('Error in weekly speech statistics:', error);
      await ctx.reply('❌ 获取统计数据失败');
    }
  },
);

export default speechPerWeekCommand;
