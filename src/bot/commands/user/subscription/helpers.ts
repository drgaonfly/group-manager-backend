import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import Subscription from '../../../../models/subscription';
import { formatBeijingDate } from '../../../../utils/formatBeijingDate';
import createDebug from 'debug';

const debug = createDebug('bot:subscription');

/** 展示订阅状态总览卡片 */
export async function sendStatusCard(
  ctx: MyContext,
  edit = false,
): Promise<void> {
  const bot = ctx.currentBot;
  const botUser = ctx.currentBotUser;

  if (!bot || !botUser) return;

  // public 机器人不需要订阅功能
  if (bot.type === 'public') {
    const message = [
      `💎 <b>订阅服务</b>`,
      ``,
      `✅ 当前状态：<b>公共机器人</b>`,
      `📅 状态：<b>永久有效</b>`,
    ];
    const text = message.join('\n');

    const keyboard = new InlineKeyboard().text('❌ 关闭', 'close');

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
    return;
  }

  const now = new Date();

  // 查询当前活跃订阅
  const activeSubscription = await Subscription.findOne({
    bot: bot._id,
    botUser: botUser._id,
    status: 'paid',
  })
    .sort('-createdAt')
    .lean();

  let text = '💎 <b>订阅服务</b>\n\n';

  // 判断机器人是否已过期（仅针对 private 类型机器人）
  const isExpired =
    bot.type === 'private' && bot.disabledAt && bot.disabledAt < now;

  if (!isExpired) {
    // 机器人未过期（永久或订阅中）
    const message = [`✅ 当前状态：<b>已订阅</b>`];

    if (activeSubscription) {
      message.push(`📦 订阅月数：<b>${activeSubscription.months} 个月</b>`);
      message.push(`💰 支付金额：<b>${activeSubscription.amount} USDT</b>`);
      if (activeSubscription.createdAt) {
        message.push(
          `📅 订阅时间：<code>${formatBeijingDate(
            activeSubscription.createdAt,
          )}</code>`,
        );
      }
    } else {
      // 没有订阅记录但机器人未过期（可能是手动设置的永久）
      if (bot.disabledAt) {
        message.push(
          `📅 到期时间：<code>${formatBeijingDate(bot.disabledAt)}</code>`,
        );
      } else {
        message.push(`📅 状态：<b>永久有效</b>`);
      }
    }

    text += message.join('\n') + '\n\n';
  } else {
    // 机器人已过期
    text += `⚠️ 当前状态：<b>未订阅</b>\n\n`;
    text += `⚠️ 机器人已于 ${formatBeijingDate(
      bot.disabledAt,
    )} 过期，请及时续费\n\n`;
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

  const message = [
    `💳 <b>订阅支付</b>`,
    ``,
    `📦 订阅月数：<b>${subscription.months} 个月</b>`,
    `💰 支付金额：<b>${subscription.amount} USDT</b>`,
    `⏰ 订单剩余时间：<b>${remaining} 分钟</b>`,
    ``,
    `📍 收款地址（TRC20）：`,
    `<code>${subscription.toAddress}</code>`,
    ``,
    `⚠️ 请务必使用 <b>TRC20 网络</b> 转账准确金额！`,
    `✅ 支付后系统将自动确认并开通服务。`,
  ];
  const text = message.join('\n');

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
