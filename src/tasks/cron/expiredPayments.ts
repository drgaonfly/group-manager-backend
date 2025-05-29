// src/cron/expiredOrders.ts
import Payment from '../../models/payment';
import BotUser from '../../models/botUser';
import { IBot } from '../../models/bot';
import { setupBot } from '../../bot/botSetup';

export async function checkExpiredPayments() {
  try {
    console.log('[expiredOrders] 开始检查过期订单...');
    // 查询已过期但未处理的订单
    const expiredPayments = await Payment.find({
      status: 'pending',
      expiredAt: { $lte: new Date() },
    })
      .populate('botUser')
      .populate('bot');

    console.log(
      `[expiredOrders] 查询到 ${expiredPayments.length} 个待处理的过期订单`,
    );

    for (const payment of expiredPayments) {
      console.log(`[expiredOrders] 正在处理订单: ${payment.orderNumber}`);

      // 设置订单状态为过期
      payment.status = 'expired';
      await payment.save();

      console.log(
        `[expiredOrders] 订单 ${payment.orderNumber} 状态已更新为 expired`,
      );

      const botUser = await BotUser.findById(payment.botUser);
      const dbBot = payment.bot as IBot;
      const bot = setupBot(dbBot.token);

      // 新增：如果 payment 记录了 tgChatId 和 tgMessageId，尝试删除该消息
      if (payment.tgChatId && payment.tgMessageId) {
        try {
          await bot.api.deleteMessage(payment.tgChatId, payment.tgMessageId);
          console.log(
            `[expiredOrders] 已删除用户 ${payment.tgChatId} 的订单消息 (message_id: ${payment.tgMessageId})`,
          );
        } catch (deleteErr) {
          console.warn(
            `[expiredOrders] 删除消息失败 (chat_id: ${payment.tgChatId}, message_id: ${payment.tgMessageId}):`,
            deleteErr,
          );
        }
      }

      if (botUser?.id) {
        try {
          // 构建订阅信息文本
          let subscriptionInfoText = '';
          if (payment.subscriptionInfo) {
            const { label, price, days } = payment.subscriptionInfo;
            subscriptionInfoText =
              `\n<b>订阅类型:</b> ${label}\n` +
              `<b>套餐时长:</b> ${days} 天\n` +
              `<b>订单金额:</b> ${price} USDT\n`;
          }

          await bot.api.sendMessage(
            botUser.id,
            `⌛ 订单 <code>${
              payment.orderNumber
            }</code> 已超时未支付，自动取消。${
              subscriptionInfoText ? '\n' + subscriptionInfoText : ''
            }`,
            { parse_mode: 'HTML' },
          );
          console.log(`[expiredOrders] 已通知用户 ${botUser.id} 订单过期`);
        } catch (msgErr) {
          console.error(`[expiredOrders] 通知用户 ${botUser.id} 失败:`, msgErr);
        }
      } else {
        console.warn(
          `[expiredOrders] 未找到用户信息，无法通知，订单号: ${payment.orderNumber}`,
        );
      }

      console.log(`订单 ${payment.orderNumber} 已标记为过期`);
    }
    console.log('[expiredOrders] 过期订单处理完成');
  } catch (error) {
    console.error('处理过期订单时出错:', error);
  }
}
