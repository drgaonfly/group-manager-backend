import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import Subscription from '../../../../models/subscription';
import { sendPaymentCard, ORDER_TIMEOUT_MINUTES } from './helpers';
import createDebug from 'debug';

const debug = createDebug('bot:subscription:pay');

const plans = [
  { months: 1, price: 15, label: '一个月' },
  { months: 900, price: 400, label: '永久' },
];

const payCallback = new Composer<MyContext>();

payCallback.callbackQuery('subscription_pay', async (ctx) => {
  await ctx.answerCallbackQuery();

  const bot = ctx.currentBot;
  const botUser = ctx.currentBotUser;

  if (!bot || !botUser) return;

  const ownerIdStr = bot.owner?.toString();
  const currentBotUserIdStr = botUser._id?.toString();
  const isOwner =
    ownerIdStr && currentBotUserIdStr && ownerIdStr === currentBotUserIdStr;

  if (!isOwner) {
    await ctx.answerCallbackQuery('❌ 只有机器人所有者可以使用此功能');
    return;
  }

  if (!bot.trx20_address) {
    await ctx.reply('❌ 收款地址未配置，请联系管理员设置 TRC20 地址后再续费。');
    return;
  }

  const text = `💳 <b>选择订阅套餐</b>\n\n<b>请选择订阅时长：</b>`;

  const keyboard = new InlineKeyboard();
  plans.forEach((plan, index) => {
    keyboard.text(
      `${plan.label} ${plan.price}U`,
      `subscription_plan_${plan.months}`,
    );
    if (index < plans.length - 1) {
      keyboard.row();
    }
  });
  keyboard.row().text('❌ 返回', 'subscription_start');

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (err: any) {
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }
});

// 处理订阅套餐选择
payCallback.callbackQuery(/^subscription_plan_/, async (ctx) => {
  await ctx.answerCallbackQuery();

  const bot = ctx.currentBot;
  const botUser = ctx.currentBotUser;

  if (!bot || !botUser) return;

  const months = parseInt(
    ctx.callbackQuery.data.replace('subscription_plan_', ''),
  );
  const planConfig = plans.find((p) => p.months === months);

  if (!planConfig) {
    await ctx.reply('❌ 无效的订阅计划');
    return;
  }

  // 检查是否已有未超时的 pending 订单
  const existing = await Subscription.findOne({
    bot: bot._id,
    botUser: botUser._id,
    status: 'pending',
    orderExpiredAt: { $gt: new Date() },
  }).lean();

  if (existing) {
    await sendPaymentCard(ctx, existing, true);
    return;
  }

  try {
    // 生成唯一金额（基础价格 + 随机尾数，避免金额冲突）
    const tail = Math.floor(Math.random() * 99 + 1) / 100;
    const uniqueAmount = Math.round((planConfig.price + tail) * 100) / 100;

    const orderExpiredAt = new Date();
    orderExpiredAt.setMinutes(
      orderExpiredAt.getMinutes() + ORDER_TIMEOUT_MINUTES,
    );

    const newSubscription = new Subscription({
      botUser: botUser._id,
      bot: bot._id,
      amount: uniqueAmount,
      months: planConfig.months,
      toAddress: bot.trx20_address,
      orderExpiredAt,
      status: 'pending',
    });

    const savedSubscription = await newSubscription.save();
    await sendPaymentCard(ctx, savedSubscription, true);
  } catch (error: any) {
    debug('创建订阅订单失败:', error);
    await ctx.reply(
      '❌ <b>创建订单失败</b>\n\n' + (error?.message || '未知错误'),
      { parse_mode: 'HTML' },
    );
  }
});

export default payCallback;
