import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import Exchange from '../../../../models/exchange';

const exchangeClearCommand = new Composer<MyContext>();

const debug = createDebug('bot:exchange:clear');

// 清除订单回调处理
exchangeClearCommand.hears('清除兑换记录', async (ctx) => {
  debug('clear_exchange callback triggered');

  // 查找今天创建的 exchange
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  await Exchange.deleteMany({
    createdAt: {
      $gte: startOfToday,
      $lte: endOfToday,
    },
  });

  ctx.reply(`今日订单号已清除`);
});

export default exchangeClearCommand;
