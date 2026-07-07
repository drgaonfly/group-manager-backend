import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import Subscription from '../../../../models/subscription';
import BotUserConfig from '../../../../models/botUserConfig';
import { renewalOptions } from '../../../../models/subscription';
import createDebug from 'debug';

const debug = createDebug('bot:subscription');

export const ORDER_TIMEOUT_MINUTES = 30;

/** 展示订阅状态总览卡片 */
export async function sendStatusCard(
  ctx: MyContext,
  edit = false,
): Promise<void> {
  const bot = ctx.currentBot;
  const botUser = ctx.currentBotUser;

  if (!bot || !botUser) return;

  const now = new Date();

  // 查询当前活跃订阅
  const activeSubscription = await Subscription.findOne({
    bot: bot._id,
    botUser: botUser._id,
    status: 'paid',
    endDate: { $gt: now },
  })
    .sort('-endDate')
    .lean();

  const userConfig = await BotUserConfig.findOne({
    bot: bot._id,
    botUser: botUser._id,
  }).lean();

  let text = '💎 <b>订阅服务</b>\n\n';

  if (activeSubscription && activeSubscription.endDate) {
    const planConfig = renewalOptions[activeSubscription.plan];
    text += `✅ 当前状态：<b>已订阅</b>\n`;
    text += `📅 到期时间：<code>${activeSubscription.endDate.toLocaleString(
      'zh-CN',
      { hour12: false },
    )}</code>\n`;
    text += `📦 订阅计划：<b>${
      planConfig?.label || activeSubscription.plan
    }</b>\n\n`;
  } else {
    text += `⚠️ 当前状态：<b>未订阅</b>\n\n`;
    if (
      userConfig?.subscriptionEndDate &&
      userConfig.subscriptionEndDate < now
    ) {
      text += `您的订阅已于 ${userConfig.subscriptionEndDate.toLocaleString(
        'zh-CN',
        { hour12: false },
      )} 过期\n\n`;
    }
  }

  const keyboard = new InlineKeyboard()
    .text('💳 购买订阅', 'subscription_pay')
    .text('🔄 刷新状态', 'subscription_refresh')
    .row()
    .text('❌ 关闭', 'close');

  try {
    if (edit) {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  } catch (err: any) {
    debug('发送状态卡片失败:', err?.message);
  }
}

/** 展示付款信息卡片 */
export async function sendPaymentCard(
  ctx: MyContext,
  subscription: any,
  edit = false,
): Promise<void> {
  const expiredAt = new Date(subscription.orderExpiredAt);
  const remaining = Math.max(
    0,
    Math.round((expiredAt.getTime() - Date.now()) / 60000),
  );

  const planConfig = renewalOptions[subscription.plan];

  const text =
    `💳 <b>订阅支付</b>\n\n` +
    `📦 订阅计划：<b>${planConfig?.label || subscription.plan}</b>\n` +
    `💰 支付金额：<b>${subscription.amount} USDT</b>\n` +
    `⏰ 剩余时间：<b>${remaining} 分钟</b>\n\n` +
    `📍 收款地址（TRC20）：\n` +
    `<code>${subscription.toAddress}</code>\n\n` +
    `⚠️ 请务必使用 <b>TRC20 网络</b> 转账准确金额！\n` +
    `✅ 支付后系统将自动确认并开通服务。\n\n` +
    `订单号：<code>${subscription.id}</code>`;

  const keyboard = new InlineKeyboard()
    .text('🔍 查询到账', 'subscription_check')
    .text('↩️ 返回', 'subscription_refresh')
    .row()
    .text('❌ 关闭', 'close');

  try {
    if (edit) {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  } catch (err: any) {
    debug('发送付款卡片失败:', err?.message);
  }
}
