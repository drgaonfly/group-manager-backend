import Subscription from '../../models/subscription';
import { IBotUser } from '../../models/botUser';
import Bot, { IBot } from '../../models/bot';
import { setupBot } from '../../bot/botSetup';
import BotUserConfig, { UserStatus } from '../../models/botUserConfig';
import { getUSDTTransfers } from '../../services/checkUsdt';
import { formatBeijingDate } from '../../utils/formatBeijingDate';

/**
 * 检查所有 pending 的 subscription，只有当环境变量 TRX20_ADDRESS 或 bot.trx20_address 收到正确金额，才激活订阅
 */
export async function checkPendingOrders() {
  try {
    console.log('[checkPendingOrders] 开始检查所有待处理的订阅订单...');

    // 查询所有待处理的订阅订单（pending 状态）
    const pendingSubscriptions = await Subscription.find({
      status: 'pending',
      orderExpiredAt: { $gt: new Date() },
    })
      .populate('botUser')
      .populate('bot');

    console.log(
      `[checkPendingOrders] 查询到 ${pendingSubscriptions.length} 个待处理的订阅订单`,
    );

    for (const subscription of pendingSubscriptions) {
      // 检查 subscription 是否已经有 txHash，防止重复处理
      if (subscription.txHash) {
        console.log(
          `[checkPendingOrders] 订单 ${subscription._id} 已有交易哈希，跳过`,
        );
        continue;
      }

      const botUser = subscription.botUser as IBotUser;
      const bot = subscription.bot as IBot;
      const receiveAddress = subscription.toAddress;

      if (!receiveAddress) {
        console.warn(
          `[checkPendingOrders] 订单 ${subscription._id} 缺少收款地址，跳过`,
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
        (t) => Math.abs(t.money - subscription.amount) <= AMOUNT_TOLERANCE,
      );

      if (!matchedTransfer) {
        console.log(
          `[checkPendingOrders] 订单 ${subscription._id} 未检测到 ${receiveAddress} 收到 ${subscription.amount} USDT 的转账（允许±${AMOUNT_TOLERANCE}误差），跳过`,
        );
        continue;
      }

      // 生成订阅起止时间
      const months = subscription.months;

      // 先查找当前 Bot，获取原有的 disabledAt
      const currentBot = await Bot.findById(bot._id);

      let baseDate = new Date();
      let isRenewal = false;

      // 优先使用机器人的 disabledAt 作为基准
      if (
        currentBot &&
        currentBot.disabledAt &&
        currentBot.disabledAt > baseDate
      ) {
        baseDate = currentBot.disabledAt;
        isRenewal = true; // 续费类型
      } else {
        // 如果机器人已过期或没有设置，使用 BotUserConfig 的 subscriptionEndDate
        const userConfig = await BotUserConfig.findOne({
          bot: bot._id,
          botUser: botUser._id,
        });
        if (
          userConfig &&
          userConfig.subscriptionEndDate &&
          userConfig.subscriptionEndDate > baseDate
        ) {
          baseDate = userConfig.subscriptionEndDate;
          isRenewal = true;
        }
      }

      const expiredAt = new Date(
        baseDate.getTime() + months * 30 * 24 * 60 * 60 * 1000,
      );

      // 更新订阅记录
      subscription.status = 'paid';
      subscription.endDate = expiredAt;
      subscription.startDate = baseDate;
      subscription.txHash = matchedTransfer.trade_id;
      subscription.fromAddress = matchedTransfer.buyer;
      subscription.transactionAt = new Date(matchedTransfer.time * 1000);
      subscription.paidAmount = matchedTransfer.money;
      subscription.paidAt = new Date();
      await subscription.save();

      // 同步更新 BotUserConfig 表
      await BotUserConfig.findOneAndUpdate(
        { bot: bot._id, botUser: botUser._id },
        {
          status: UserStatus.AUTHORIZED,
          subscriptionEndDate: expiredAt,
          currentPlan: subscription.months.toString(),
        },
        { new: true },
      );

      // 同步更新 Bot 的 disabledAt（延长机器人禁用时间）
      await Bot.findByIdAndUpdate(
        bot._id,
        {
          disabledAt: expiredAt,
          isExpired: false, // 重置过期状态
          preExpirationNotified: false, // 重置提醒状态
        },
        { new: true },
      );

      // 发送支付成功通知
      const telegramBot = setupBot(bot.token);

      try {
        await telegramBot.api.sendMessage(
          botUser.id,
          `✅ 支付成功！\n\n` +
            `订阅月数: ${months}个月\n` +
            `到期时间: ${formatBeijingDate(expiredAt)}\n\n` +
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
        `[checkPendingOrders] 已激活订阅 ${subscription._id}，isRenewal: ${isRenewal}`,
      );
    }

    console.log('[checkPendingOrders] 待处理订阅订单处理完成');
  } catch (error) {
    console.error('[checkPendingOrders] 处理待处理订阅订单时出错:', error);
  }
}
