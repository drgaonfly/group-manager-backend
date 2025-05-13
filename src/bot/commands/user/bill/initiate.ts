import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import { isOperatorOrCreator } from '../../../../bot/middlewares/checkBotUser';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';
const initiateCommand = new Composer<MyContext>();

const debug = createDebug('bot:initiate');

initiateCommand.hears(
  /^开始$/,
  checkGroup,
  isOperatorOrCreator,
  async (ctx) => {
    debug('bot:initiate');

    // 检查当前是否已经在记录
    if (!ctx.currentGroup.isOnline) {
      ctx.currentGroup.isOnline = true;
      await ctx.currentGroup.save();
      await ctx.reply('机器人开始记录今天账单');
    } else {
      await ctx.reply('我已在记录账单啦');
    }
  },
);

export default initiateCommand;
