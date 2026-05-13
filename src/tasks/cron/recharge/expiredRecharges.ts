// src/cron/expiredRecharges.ts
import Recharge from '../../../models/recharge';
import BotUser from '../../../models/botUser';
import { IBot } from '../../../models/bot';
import { setupBot } from '../../../bot/botSetup';

export async function checkExpiredRecharges() {
  try {
    console.log('[expiredRecharges] 开始检查过期充值订单...');
    // 查询已过期但未处理的充值订单
    const expiredRecharges = await Recharge.find({
      status: 'pending',
      expiredAt: { $lte: new Date() },
    })
      .populate('botUser')
      .populate('bot');

    console.log(
      `[expiredRecharges] 查询到 ${expiredRecharges.length} 个待处理的过期充值订单`,
    );

    for (const recharge of expiredRecharges) {
      console.log(`[expiredRecharges] 正在处理充值订单: ${recharge.id}`);

      // 更新订单状态为过期并保存
      await Recharge.updateOne(
        { _id: recharge._id },
        { $set: { status: 'expired' } },
      );

      console.log(
        `[expiredRecharges] 充值订单 ${recharge.id} 状态已更新为 expired`,
      );

      const botUser = await BotUser.findById(recharge.botUser);
      const dbBot = recharge.bot as IBot;
      const bot = setupBot(dbBot.token);

      if (botUser?.id) {
        try {
          const messageText = `⌛ 充值订单 <code>${recharge.id}</code> 已超时未支付，自动取消。`;

          await bot.api.sendMessage(botUser.id, messageText, {
            parse_mode: 'HTML',
          });
          console.log(
            `[expiredRecharges] 已通知用户 ${botUser.id} 充值订单过期`,
          );
        } catch (msgErr) {
          console.error(
            `[expiredRecharges] 通知用户 ${botUser.id} 失败:`,
            msgErr,
          );
        }
      } else {
        console.warn(
          `[expiredRecharges] 未找到用户信息，无法通知，充值订单号: ${recharge.id}`,
        );
      }

      console.log(`充值订单 ${recharge.id} 已标记为过期`);
    }
    console.log('[expiredRecharges] 过期充值订单处理完成');
  } catch (error) {
    console.error('处理过期充值订单时出错:', error);
  }
}
