import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import Subscription from '../../../../models/subscription';
import { sendPaymentCard, sendStatusCard } from './helpers';
import createDebug from 'debug';

const debug = createDebug('bot:subscription:check');

const checkCallback = new Composer<MyContext>();

checkCallback.callbackQuery('subscription_check', async (ctx) => {
  await ctx.answerCallbackQuery('🔍 正在查询...');

  const bot = ctx.currentBot;
  const botUser = ctx.currentBotUser;

  if (!bot || !botUser) return;

  // public 机器人不需要订阅功能
  if (bot.type === 'public') {
    await ctx.answerCallbackQuery('❌ 公共机器人不需要订阅');
    await sendStatusCard(ctx, false);
    return;
  }

  // 查询最新的 pending 订单
  const pendingOrder = await Subscription.findOne({
    bot: bot._id,
    botUser: botUser._id,
    status: 'pending',
    orderExpiredAt: { $gt: new Date() },
  })
    .sort('-createdAt')
    .lean();

  if (!pendingOrder) {
    await ctx.reply('ℹ️ 当前没有待支付的订单');
    await sendStatusCard(ctx, false);
    return;
  }

  // 刷新订单状态（可能被定时任务更新了）
  const updatedOrder = await Subscription.findById(pendingOrder._id).lean();

  if (!updatedOrder) {
    await ctx.reply('❌ 订单不存在');
    return;
  }

  if (updatedOrder.status === 'paid') {
    await ctx.reply(
      '✅ <b>支付成功！</b>\n\n' + '您的订阅已激活，感谢您的支持！',
      { parse_mode: 'HTML' },
    );
    await sendStatusCard(ctx, false);
  } else if (updatedOrder.status === 'timeout') {
    await ctx.reply('⏰ 订单已超时，请重新创建订单');
    await sendStatusCard(ctx, false);
  } else {
    await ctx.reply(
      'ℹ️ 暂未检测到付款，请稍后再试\n\n' + '系统每 5 分钟会自动检测一次',
    );
    await sendPaymentCard(ctx, updatedOrder, false);
  }
});

export default checkCallback;
