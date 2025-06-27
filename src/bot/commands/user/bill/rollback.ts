import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import Transaction from '../../../../models/transaction';
import { isOperatorOrCreator } from '../../../../bot/middlewares/checkBotUser';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';
import { checkIsOnline } from '../../../../bot/middlewares/checkIsOnline';
import { checkPermission } from '../../../middlewares/checkPermission';

const rollbackBillCommand = new Composer<MyContext>();

const debug = createDebug('bot:bill:rollback');

// 回滚订单回调处理
rollbackBillCommand.hears(
  '撤回',
  checkGroup,
  checkPermission,
  isOperatorOrCreator,
  checkIsOnline,
  async (ctx) => {
    debug('rollback_bill callback triggered');

    // 查找今天创建的 exchange 的最后一条记录
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // 查找今天最后一条记录
    const lastTransaction = await Transaction.findOne({
      createdAt: {
        $gte: startOfToday,
        $lte: endOfToday,
      },
      group: ctx.currentGroup?._id,
    }).sort({ createdAt: -1 });

    if (!lastTransaction) {
      await ctx.reply('今日没有可撤回的账单记录');
      return;
    }

    await lastTransaction.deleteOne();

    await ctx.reply('已撤回今日最后一条账单记录');
  },
);

export default rollbackBillCommand;
