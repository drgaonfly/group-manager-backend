import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import { isBotOwner } from '../../../middlewares/checkBotOwner';
import Subscription from '../../../../models/subscription';
import Setting from '../../../../models/setting';
import { sendPaymentCard } from './helpers';
import createDebug from 'debug';

const debug = createDebug('bot:subscription:pay');

const payCallback = new Composer<MyContext>();

payCallback.callbackQuery('subscription_pay', isBotOwner, async (ctx) => {
  await ctx.answerCallbackQuery();

  const bot = ctx.currentBot;
  const botUser = ctx.currentBotUser;

  if (!bot || !botUser) return;

  // public 机器人不需要订阅功能
  if (bot.type === 'public') {
    await ctx.answerCallbackQuery('❌ 公共机器人不需要订阅');
    return;
  }

  // 从数据库获取系统设置
  const setting = await Setting.findOne();

  if (!setting.trx20Address) {
    await ctx.reply('❌ 收款地址未配置，请等待管理员配置TRC20地址');
    return;
  }

  if (!setting.subscriptionPlans) {
    await ctx.reply('❌ 订阅计划未配置，请等待管理员配置订阅计划');
    return;
  }

  const text = `💳 <b>选择订阅套餐</b>\n\n<b>请选择订阅时长：</b>`;

  const keyboard = new InlineKeyboard();
  setting.subscriptionPlans.forEach((plan, index) => {
    keyboard.text(
      `${plan.label} ${plan.price}U`,
      `subscription_plan_${plan.months}`,
    );
    if (index < setting.subscriptionPlans.length - 1) {
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

  // 从数据库获取系统设置
  const setting = await Setting.findOne();
  if (!setting) {
    await ctx.reply('❌ 系统设置未配置，请联系管理员');
    return;
  }

  const planConfig = setting.subscriptionPlans.find((p) => p.months === months);

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
      orderExpiredAt.getMinutes() + setting.orderTimeoutMinutes,
    );

    const newSubscription = new Subscription({
      botUser: botUser._id,
      bot: bot._id,
      amount: uniqueAmount,
      months: planConfig.months,
      toAddress: setting.trx20Address,
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
