import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import Transaction from '../../../../models/transaction';
import { isOperatorOrCreator } from '../../../../bot/middlewares/checkBotUser';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';
import { checkIsOnline } from '../../../../bot/middlewares/checkIsOnline';
import { checkPermission } from '../../../middlewares/checkPermission';

const clearBillCommand = new Composer<MyContext>();

const debug = createDebug('bot:bill:clear');

// 清除订单回调处理
clearBillCommand.hears(
  '清除账单',
  checkGroup,
  checkPermission,
  isOperatorOrCreator,
  checkIsOnline,
  async (ctx) => {
    debug('clear_bill callback triggered');

    // 查找今天创建的 exchange
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    await Transaction.deleteMany({
      createdAt: {
        $gte: startOfToday,
        $lte: endOfToday,
      },
    });

    ctx.reply(`今日账单已清除`);
  },
);

export default clearBillCommand;
