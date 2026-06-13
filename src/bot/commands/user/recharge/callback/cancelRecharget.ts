import { Composer } from 'grammy';
import { MyContext } from '../../../../types';
import Recharge from '../../../../../models/recharge';
import createDebug from 'debug';

const cancelRechargeCallback = new Composer<MyContext>();
const debug = createDebug('bot:取消充值');

cancelRechargeCallback.callbackQuery(/^recharge:cancel_(.+)$/, async (ctx) => {
  debug('取消充值');

  await ctx.conversation.exitAll();

  const rechargeId = ctx.match?.[1]; // 提取 recharge._id

  // 只允许 pending 状态的订单取消
  const recharge = await Recharge.findById(rechargeId);

  if (!recharge) {
    await ctx.answerCallbackQuery('订单不存在或已被删除');
    return;
  }

  if (recharge.status !== 'pending') {
    await ctx.answerCallbackQuery('订单已过期或无法取消');
    return;
  }

  await Recharge.findByIdAndUpdate(rechargeId, {
    status: 'cancelled',
  });

  await ctx.deleteMessage();

  await ctx.answerCallbackQuery('订单已取消');
});

export default cancelRechargeCallback;
