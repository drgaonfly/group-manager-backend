// src/cron/expiredOrders.ts
import Payment from '../../models/payment';
import BotUser from '../../models/botUser';
import { IBot } from '../../models/bot';
import { setupBot } from '../../bot/botSetup';

export async function checkExpiredOrders() {
  try {
    // 查询已过期但未处理的订单
    const expiredPayments = await Payment.find({
      status: 'pending',
      expiresAt: { $lte: new Date() },
    });

    for (const payment of expiredPayments) {
      // 设置订单状态为过期
      payment.status = 'expired';
      await payment.save();

      // 如果有bot实例，发送通知给用户
      if (payment.botUser) {
        const botUser = await BotUser.findById(payment.botUser);
        const dbBot = payment.bot as IBot;
        const bot = setupBot(dbBot.token);

        if (botUser?.id) {
          await bot.api.sendMessage(
            botUser.id,
            `⌛ 订单 #${payment._id} 已超时未支付，自动取消。\n` +
              `如需重新支付请使用 /pay 命令`,
          );
        }
      }

      console.log(`订单 ${payment._id} 已标记为过期`);
    }

    return { processed: expiredPayments.length };
  } catch (error) {
    console.error('处理过期订单时出错:', error);
    return { error: error.message };
  }
}
