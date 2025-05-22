// src/composers/callback.ts
import { CallbackQueryContext, Composer } from 'grammy';
import createDebug from 'debug';
import { handleRenewalMessage } from './renewal';
import { MyContext } from '../../../types';
import Payment from '../../../../models/payment';
import { renewalOptions } from '../../../../models/subscription';

const debug = createDebug('bot:subscription:callback');

// 创建一个 Composer 实例
const callbackComposer = new Composer();

callbackComposer.callbackQuery(
  'auto_renew',
  async (ctx: CallbackQueryContext<MyContext>) => {
    const data = ctx.callbackQuery?.data;

    debug(`用户点击了按钮: ${data}`);
    // await ctx.answerCallbackQuery(`您点击了按钮: ${data}`);
    await handleRenewalMessage(ctx);
  },
);

callbackComposer.callbackQuery(
  /^subscribe:/,
  async (ctx: CallbackQueryContext<MyContext>) => {
    const data = ctx.callbackQuery?.data;
    const bot = ctx.currentBot;

    // 从回调数据中提取订阅类型
    const subscribeType = data?.split(':')[1];

    // 获取对应的订阅选项信息
    const renewalOption = renewalOptions[subscribeType];

    debug(`用户点击了订阅按钮: ${data}`);
    debug('订阅选项信息:', {
      type: subscribeType,
      days: renewalOption?.days,
      price: renewalOption?.price,
      label: renewalOption?.label,
    });
    const address = bot.trx20_address;

    const customer_service_link = bot.customer_service_link;

    if (!address) {
      await ctx.reply('机器人还未设置收款地址');
      return;
    }

    // 创建一个新的支付记录
    const payment = new Payment({
      receiveAddress: address,
      amount: renewalOption?.price, // 使用对应的价格
      status: 'pending',
      type: 'subscription',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15分钟后过期
      botUser: ctx.currentBotUser._id,
      bot: bot._id,
      // 添加订阅相关信息
      subscriptionInfo: {
        price: renewalOption?.price,
        type: subscribeType,
        days: renewalOption?.days,
        label: renewalOption?.label,
      },
    });

    // 保存支付记录
    await payment.save();

    // 发送支付信息给用户
    await ctx.reply(
      `<b>订单支付信息</b>\n\n` +
        `订阅类型: ${renewalOption?.label}\n` +
        `订单金额: ${payment.amount} USDT\n\n` +
        `trx-20 转账地址：\n<code>${address}</code> (点击地址可自动复制)\n\n` +
        `注意事项：\n` +
        `1. 请务必按指定金额转账，否则无法自动化延期。\n` +
        `2. 转账成功10秒钟左右即可自动续费成功。\n` +
        `3. 如遇到问题，请联系 记账机器人售后客服\n\n` +
        `⚠️ 订单将在15分钟后失效，请尽快完成支付`,
      {
        parse_mode: 'HTML',
      },
    );
  },
);

export default callbackComposer;
