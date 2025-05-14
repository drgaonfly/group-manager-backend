import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import { isOperatorOrCreator } from '../../../../bot/middlewares/checkBotUser';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';
import Transaction from '../../../../models/transaction';

const initiateCommand = new Composer<MyContext>();

const debug = createDebug('bot:initiate');

initiateCommand.hears(
  /^开始$/,
  checkGroup,
  isOperatorOrCreator,
  async (ctx) => {
    debug('bot:initiate');

    // 检查今天是否有交易记录
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const hasTransactionToday = await Transaction.exists({
      group: ctx.currentGroup._id,
      createdAt: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    debug('hasTransactionToday', hasTransactionToday);

    if (!hasTransactionToday) {
      ctx.currentGroup.isOnline = false;
      ctx.currentGroup.startAt = null;
      await ctx.currentGroup.save();
    }

    // 检查当前是否已经在记录
    if (!ctx.currentGroup.isOnline) {
      ctx.currentGroup.startAt = new Date();
      ctx.currentGroup.isOnline = true;
      await ctx.currentGroup.save();
      await ctx.reply('机器人开始记录今天账单');
    } else {
      await ctx.reply('我已在记录账单啦');
    }
  },
);

export default initiateCommand;
