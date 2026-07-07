import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import Subscription from '../../../../models/subscription';
import { renewalOptions } from '../../../../models/subscription';
import { sendPaymentCard, ORDER_TIMEOUT_MINUTES } from './helpers';
import axios from 'axios';
import createDebug from 'debug';

const debug = createDebug('bot:subscription:pay');

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
  Object.entries(renewalOptions).forEach(([key, option], index) => {
    keyboard.text(
      `${option.label} ${option.price}U`,
      `subscription_plan_${key}`,
    );
    if (index < Object.keys(renewalOptions).length - 1) {
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

  const plan = ctx.callbackQuery.data.replace('subscription_plan_', '');
  const planConfig = renewalOptions[plan];

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
    // 调用后台 API 创建订阅订单
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5010';

    const response = await axios.post(`${backendUrl}/api/subscriptions`, {
      botId: bot._id,
      botUserId: botUser._id,
      plan,
      timeoutMinutes: ORDER_TIMEOUT_MINUTES,
    });

    const subscription = response.data?.data;

    if (!subscription) {
      throw new Error('创建订阅订单失败');
    }

    await sendPaymentCard(ctx, subscription, true);
  } catch (error: any) {
    debug('创建订阅订单失败:', error);
    await ctx.reply(
      '❌ <b>创建订单失败</b>\n\n' +
        (error?.response?.data?.message || error?.message || '未知错误'),
      { parse_mode: 'HTML' },
    );
  }
});

export default payCallback;
