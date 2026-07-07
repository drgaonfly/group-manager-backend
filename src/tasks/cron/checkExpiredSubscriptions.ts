import BotUserConfig, { UserStatus } from '../../models/botUserConfig';
import Subscription, { renewalOptions } from '../../models/subscription';
import { IBot } from '../../models/bot';
import { setupBot } from '../../bot/botSetup';
import { IBotUser } from '../../models/botUser';

/**
 * 检查所有已过期的订阅，将其状态设置为 expired。
 * 只有当用户所有订阅都过期时，才将 BotUserConfig 状态更新为 SUBSCRIPTION_EXPIRED。
 * 向用户发送详细的订阅过期通知。
 */
export async function checkExpiredSubscriptions() {
  try {
    console.log('[checkExpiredSubscriptions] 开始检查过期订阅...');
    // 查询所有已过期但状态仍为 paid 的订阅
    const now = new Date();
    const expiredSubscriptions = await Subscription.find({
      status: 'paid',
      endDate: { $lte: now },
    })
      .populate('botUser')
      .populate('bot');

    console.log(
      `[checkExpiredSubscriptions] 查询到 ${expiredSubscriptions.length} 个已过期的订阅`,
    );

    for (const subscription of expiredSubscriptions) {
      const botUser = subscription.botUser as IBotUser;
      const bot = subscription.bot as IBot;

      // 更新订阅状态为 expired
      subscription.status = 'expired';
      await subscription.save();

      // 检查该用户在该 bot 下是否还有其他 paid 且未过期的订阅
      const stillActive = await Subscription.findOne({
        bot: bot._id,
        botUser: botUser._id,
        status: 'paid',
        endDate: { $gt: now },
      });

      if (!stillActive) {
        // 只有当没有其他有效订阅时，才更新 BotUserConfig 状态
        await BotUserConfig.findOneAndUpdate(
          {
            bot: bot._id,
            botUser: botUser._id,
          },
          {
            status: UserStatus.SUBSCRIPTION_EXPIRED,
          },
          { new: true },
        );
        console.log(
          `[checkExpiredSubscriptions] 订阅 ${subscription._id} 状态已更新为 expired，用户 ${botUser.id} 的 BotUserConfig 状态已更新为 SUBSCRIPTION_EXPIRED`,
        );
      } else {
        console.log(
          `[checkExpiredSubscriptions] 订阅 ${subscription._id} 状态已更新为 expired，用户 ${botUser.id} 仍有其他有效订阅，BotUserConfig 状态不变`,
        );
      }

      // 发送详细的订阅过期通知
      const telegramBot = setupBot(bot.token);
      try {
        // 获取订阅类型详细信息
        let planLabel = subscription.plan;
        if (renewalOptions[subscription.plan]) {
          planLabel = renewalOptions[subscription.plan].label;
        }
        const endDateStr = subscription.endDate
          ? subscription.endDate.toLocaleString('zh-CN', { hour12: false })
          : '';
        let msg =
          `⚠️ 您的订阅已到期。\n\n` +
          `订阅类型: <b>${planLabel}</b>\n` +
          `到期时间: <code>${endDateStr}</code>\n\n` +
          `如需继续使用服务，请及时续费。`;

        if (!stillActive) {
          msg += `\n\n当前您已无有效订阅，部分功能将受限。`;
        } else {
          msg += `\n\n您仍有其他有效订阅，服务不会中断。`;
        }

        await telegramBot.api.sendMessage(botUser.id, msg, {
          parse_mode: 'HTML',
        });
        console.log(
          `[checkExpiredSubscriptions] 已通知用户 ${botUser.id} 订阅过期`,
        );
      } catch (msgErr) {
        console.error(
          `[checkExpiredSubscriptions] 通知用户 ${botUser.id} 失败:`,
          msgErr,
        );
      }
    }

    console.log('[checkExpiredSubscriptions] 过期订阅处理完成');
  } catch (error) {
    console.error('[checkExpiredSubscriptions] 处理过期订阅时出错:', error);
  }
}
