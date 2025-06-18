import Payment from '../../models/payment';
import Subscription, { SubscriptionStatus } from '../../models/subscription';
import { IBotUser } from '../../models/botUser';
import { IBot } from '../../models/bot';
import { setupBot } from '../../bot/botSetup';
import { IdGen } from '../../utils/idGen';
import BotUserConfig, { UserStatus } from '../../models/botUserConfig';
import { getUSDTTransfers } from '../../services/checkTrx';

/**
 * 检查所有 pending 的 payment，只有当 bot.trx20_address 收到正确金额，才生成订阅
 */
export async function checkPendingOrders() {
  try {
    console.log('[checkPendingOrders] 开始检查所有待处理的订阅订单...');

    // 查询所有待处理的订阅订单（pending 且 type 为 subscription）
    const pendingPayments = await Payment.find({
      status: 'pending',
      type: 'subscription',
    })
      .populate('botUser')
      .populate('bot');

    console.log(
      `[checkPendingOrders] 查询到 ${pendingPayments.length} 个待处理的订阅订单`,
    );

    for (const payment of pendingPayments) {
      // 检查 payment 是否已经有 subscription 记录
      if (payment.subscription) {
        console.log(
          `[checkPendingOrders] 订单 ${payment.orderNumber} 已有关联的订阅记录，跳过`,
        );
        continue;
      }

      // 检查 subscriptionInfo 是否存在
      if (!payment.subscriptionInfo) {
        console.warn(
          `[checkPendingOrders] 订单 ${payment.orderNumber} 缺少订阅信息，跳过`,
        );
        continue;
      }

      // 检查 bot 是否有 trx20_address
      const botUser = payment.botUser as IBotUser;
      const bot = payment.bot as IBot;
      const receiveAddress = bot.trx20_address || payment.receiveAddress;
      if (!receiveAddress) {
        console.warn(
          `[checkPendingOrders] 订单 ${payment.orderNumber} 的机器人未设置收款地址，跳过`,
        );
        continue;
      }

      // 查询该地址近15分钟的USDT转账
      let transfers: Awaited<ReturnType<typeof getUSDTTransfers>> = [];
      try {
        transfers = await getUSDTTransfers(receiveAddress);
      } catch (err) {
        console.error(
          `[checkPendingOrders] 获取地址 ${receiveAddress} 转账记录失败:`,
          err,
        );
        continue;
      }

      // 查找不为支出的转账
      const filterdTransfers = transfers.filter(
        (t) => t.from_address !== receiveAddress,
      );

      // 查找是否有金额和订单匹配的转账
      // 允许0.001 USDT的误差（处理不同平台的小数精度差异）
      const AMOUNT_TOLERANCE = 0.001;
      const matchedTransfer = filterdTransfers.find(
        (t) => Math.abs(t.money - payment.amount) <= AMOUNT_TOLERANCE,
      );

      if (!matchedTransfer) {
        console.log(
          `[checkPendingOrders] 订单 ${payment.orderNumber} 未检测到 ${receiveAddress} 收到 ${payment.amount} USDT 的转账（允许±${AMOUNT_TOLERANCE}误差），跳过`,
        );
        continue;
      }

      // 检查 payment 是否已经有 txHash，防止重复处理
      if (payment.txHash && payment.txHash === matchedTransfer.trade_id) {
        console.log(
          `[checkPendingOrders] 订单 ${payment.orderNumber} 已处理过该转账哈希，跳过`,
        );
        continue;
      }

      // 生成订阅起止时间
      const days = payment.subscriptionInfo.days;

      // 先查找当前 BotUserConfig，获取原有的 subscriptionEndDate
      const userConfig = await BotUserConfig.findOne({
        bot: bot._id,
        botUser: botUser._id,
      });

      let baseDate = new Date();
      let isRenewal = false;
      if (
        userConfig &&
        userConfig.subscriptionEndDate &&
        userConfig.subscriptionEndDate > baseDate
      ) {
        // 如果原有订阅还没过期，则从原有订阅结束时间顺延
        baseDate = userConfig.subscriptionEndDate;
        isRenewal = true; // 续费类型
      }
      const expiredAt = new Date(
        baseDate.getTime() + days * 24 * 60 * 60 * 1000,
      );

      // 创建订阅记录，处理 isRenewal 字段
      const subscription = new Subscription({
        id: await IdGen.next(Subscription, 'id', 6),
        botUser: botUser._id,
        bot: bot._id,
        plan: payment.subscriptionInfo.type,
        status: SubscriptionStatus.Active,
        expiredAt,
        payment: payment._id,
        isRenewal, // 是否续费类型
      });

      await subscription.save();

      // 关联 payment 和 subscription
      payment.subscription = subscription._id;
      payment.status = 'paid';
      payment.txHash = matchedTransfer.trade_id;
      payment.sendAddress = matchedTransfer.buyer;
      payment.transactionAt = new Date(matchedTransfer.time * 1000);
      payment.paymentAmount = matchedTransfer.money; // 记录实际支付金额
      await payment.save();

      // 同步更新 BotUserConfig 表
      await BotUserConfig.findOneAndUpdate(
        { bot: bot._id, botUser: botUser._id },
        {
          status: UserStatus.AUTHORIZED,
          subscriptionEndDate: expiredAt,
          currentPlan: payment.subscriptionInfo.type,
        },
        { new: true },
      );

      // 发送支付成功通知
      const telegramBot = setupBot(bot.token);

      try {
        await telegramBot.api.sendMessage(
          botUser.id,
          `✅ 支付成功！\n\n` +
            `订单号: <code>${payment.orderNumber}</code>\n` +
            `订阅类型: ${payment.subscriptionInfo.label}\n` +
            `订阅时长: ${days}天\n` +
            `到期时间: ${expiredAt.toLocaleString('zh-CN', {
              hour12: false,
            })}\n\n` +
            `本次为${isRenewal ? '续费' : '新订阅'}。\n` +
            `感谢您的订阅！`,
          { parse_mode: 'HTML' },
        );
        console.log(`[checkPendingOrders] 已通知用户 ${botUser.id} 支付成功`);
      } catch (msgErr) {
        console.error(
          `[checkPendingOrders] 通知用户 ${botUser.id} 失败:`,
          msgErr,
        );
      }

      console.log(
        `[checkPendingOrders] 已为订单 ${payment.orderNumber} 生成订阅记录，订阅ID: ${subscription.id}，isRenewal: ${isRenewal}`,
      );
    }

    console.log('[checkPendingOrders] 待处理订阅订单处理完成');
  } catch (error) {
    console.error('[checkPendingOrders] 处理待处理订阅订单时出错:', error);
  }
}
