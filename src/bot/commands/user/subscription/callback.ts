// src/composers/callback.ts
import { CallbackQueryContext, Composer, InlineKeyboard } from 'grammy';
import createDebug from 'debug';
import { handleRenewalMessage } from './renewal';
import { MyContext } from '../../../types';
import Payment from '../../../../models/payment';
import { renewalOptions } from '../../../../models/subscription';
import { IdGen } from '../../../../utils/idGen';
import crypto from 'crypto';
import dayjs from 'dayjs';

const debug = createDebug('bot:subscription:callback');

export async function generateOrderNumber(): Promise<string> {
  // 生成14位日期时间（UTC时间，格式：YYYYMMDDHHMMSS）
  const datePart = new Date()
    .toISOString()
    .replace(/[^0-9]/g, '') // 移除非数字字符（-、T、:等）
    .slice(0, 14); // 取前14位：年月日时分秒

  let orderNumber: string;
  let retryCount = 0;
  const maxRetries = 5;

  const idSuffix = crypto
    .randomBytes(8) // 生成4字节随机数据
    .toString('hex') // 转为16进制字符串
    .slice(0, 8) // 取固定4位
    .toUpperCase(); // 转为大写

  do {
    // 组合完整订单号（示例：20230921143045A3B8X7Y9）
    orderNumber = `${datePart}${idSuffix}`;

    // 检查唯一性（建议为orderNumber字段添加唯一索引）
    const exists = await Payment.findOne({ orderNumber });
    if (!exists) return orderNumber;

    retryCount++;
  } while (retryCount < maxRetries);

  throw new Error('订单号生成冲突，请重试');
}

// 创建一个 Composer 实例
const callbackComposer = new Composer<MyContext>();

// 处理订阅套餐选择
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

    if (!address) {
      await ctx.reply('机器人还未设置收款地址');
      return;
    }

    // 检查是否存在相同订阅类型的未过期待支付订单
    debug('开始检查是否存在未过期的相同订阅类型订单');
    const existingPayment = await Payment.findOne({
      status: 'pending',
      expiredAt: { $gt: new Date() },
      'subscriptionInfo.type': subscribeType,
      botUser: ctx.currentBotUser._id,
      bot: bot._id,
    });

    let payment;

    if (existingPayment) {
      debug('找到未过期的相同订阅类型订单:', existingPayment.orderNumber);
      // 如果已存在未过期订单，顺便刷新其过期时间为15分钟后
      existingPayment.expiredAt = new Date(Date.now() + 15 * 60 * 1000); // 15分钟后过期 更新下
      await existingPayment.save();
      payment = existingPayment;
    } else {
      debug('未找到未过期的相同订阅类型订单，开始创建新订单');
      // 不存在则创建新订单
      const orderNumber = await generateOrderNumber();
      debug('生成订单号:', orderNumber);
      const baseAmount = renewalOption?.price || 0;

      // 生成不重复的随机金额
      let amount;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;

      debug('开始生成不重复的随机金额');
      while (!isUnique && attempts < maxAttempts) {
        const randomDecimal = Math.floor(Math.random() * 1000);
        amount = baseAmount - 1 + randomDecimal / 1000;
        debug(`尝试生成金额: ${amount}, 第 ${attempts + 1} 次尝试`);

        // 检查是否存在相同金额的待支付订单
        const existingAmountPayment = await Payment.findOne({
          amount,
          status: 'pending',
          expiredAt: { $gt: new Date() },
        });

        if (!existingAmountPayment) {
          debug('生成唯一金额成功:', amount);
          isUnique = true;
        } else {
          debug('金额重复，继续尝试');
        }

        attempts++;
      }

      if (!isUnique) {
        debug('无法生成唯一的支付金额，已达到最大尝试次数');
        throw new Error('无法生成唯一的支付金额，请重试');
      }

      debug('开始创建新的支付记录');
      payment = new Payment({
        id: await IdGen.next(Payment, 'id', 6),
        orderNumber,
        receiveAddress: address,
        amount,
        status: 'pending',
        type: 'subscription',
        expiredAt: new Date(Date.now() + 15 * 60 * 1000), // 15分钟后过期
        botUser: ctx.currentBotUser._id,
        bot: bot._id,
        subscriptionInfo: {
          price: renewalOption?.price,
          type: subscribeType,
          days: renewalOption?.days,
          label: renewalOption?.label,
        },
        tgChatId: ctx.chat?.id,
        tgMessageId: ctx.callbackQuery?.message?.message_id,
      });

      // 保存新创建的支付记录
      await payment.save();
      debug('新支付记录创建成功:', payment.orderNumber);
    }

    // 发送支付信息给用户
    const expireTime = payment.expiredAt
      ? dayjs(payment.expiredAt).format('YYYY-MM-DD HH:mm:ss')
      : '未知';

    const keyboard = new InlineKeyboard()
      .url('📞 联系客服', bot.customer_service_link || 'https://t.me/example')
      .row()
      .text('🔄 重新选择套餐', 'renewal:select');

    const paymentMessage =
      `<b>订单支付信息</b>\n\n` +
      `订单号: <code>${payment.orderNumber}</code>\n` +
      `订阅类型: ${renewalOption?.label}\n` +
      `订单金额: ${payment.amount} USDT\n\n` +
      `trx-20 转账地址：\n<code>${address}</code> (点击地址可自动复制)\n\n` +
      `注意事项：\n` +
      `1. 请务必按指定金额转账，否则无法自动化延期。\n` +
      `2. 转账成功10秒钟左右即可自动续费成功。\n` +
      `3. 如遇到问题，请联系 记账机器人售后客服\n\n` +
      `⚠️ 订单将在15分钟后失效，请尽快完成支付\n` +
      `订单过期时间：<b>${expireTime}</b>`;

    debug('ctx.callbackQuery?.data', ctx.callbackQuery?.data);
    // 如果是回调查询，优先尝试 editMessageText
    if (ctx.callbackQuery?.message?.message_id) {
      try {
        await ctx.editMessageText(paymentMessage, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        return;
      } catch (err: any) {
        if (!err?.description?.includes('MESSAGE_NOT_MODIFIED')) {
          debug('editMessageText error:', err);
        }
      }
    }

    // 普通消息或 editMessageText 失败时，直接 reply
    await ctx.reply(paymentMessage, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  },
);

// 处理“重新选择套餐”按钮点击
callbackComposer.callbackQuery(
  /^(renewal:select|auto_renew)$/,
  async (ctx: CallbackQueryContext<MyContext>) => {
    // 编辑消息内容为续费套餐选择界面
    await handleRenewalMessage(ctx);

    // 可选：确认回调（防止客户端加载动画）
    await ctx.answerCallbackQuery();
  },
);

export default callbackComposer;
