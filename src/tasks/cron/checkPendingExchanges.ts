import { IBotUser } from '../../models/botUser';
import { IBot } from '../../models/bot';
import { setupBot } from '../../bot/botSetup';
import { getUSDTTransfers } from '../../services/checkTrx';
import Exchange from '../../models/exchange';
import { formatBeijingDate } from '../../utils/formatBeijingDate';
import { sendTRX } from '../../utils/sendTRX';

export async function checkPendingExchanges() {
  try {
    console.log('[checkPendingExchanges] 开始检查所有待处理的兑换记录...');

    // 先将已过期的记录状态改为expired
    await Exchange.updateMany(
      {
        status: 'pending',
        expiredAt: { $lte: new Date() },
      },
      {
        status: 'expired',
      },
    );

    const pendingExchanges = await Exchange.find({
      status: 'pending',
      expiredAt: { $gt: new Date() }, // 只查找未过期的兑换记录
    })
      .populate('botUser')
      .populate('bot');

    console.log(
      `[checkPendingExchanges] 查询到 ${pendingExchanges.length} 个待处理的兑换记录`,
    );

    for (const exchange of pendingExchanges) {
      // 检查 bot 是否有 auto_exchange_address
      const botUser = exchange.botUser as IBotUser;
      const bot = exchange.bot as IBot;
      const autoExchangeAddress = bot.auto_exchange_address;
      if (!autoExchangeAddress) {
        console.warn(
          `[checkPendingExchanges] 兑换记录 ${exchange.id} 的机器人未设置自动闪兑地址，跳过`,
        );
        continue;
      }

      // 查询该地址近15分钟的USDT转账
      let transfers: Awaited<ReturnType<typeof getUSDTTransfers>> = [];
      try {
        transfers = await getUSDTTransfers(autoExchangeAddress);
      } catch (err) {
        console.error(
          `[checkPendingExchanges] 获取地址 ${autoExchangeAddress} 转账记录失败:`,
          err,
        );
        continue;
      }

      // 查找不为支出的转账
      const filterdTransfers = transfers.filter(
        (t) => t.from_address !== autoExchangeAddress,
      );

      // 查找是否有金额和订单匹配的转账
      // 允许0.001 USDT的误差（处理不同平台的小数精度差异）
      const AMOUNT_TOLERANCE = 0.001;
      const matchedTransfer = filterdTransfers.find(
        (t) => Math.abs(t.money - exchange.from_amount) <= AMOUNT_TOLERANCE,
      );

      if (!matchedTransfer) {
        console.log(
          `[checkPendingExchanges] 兑换记录 ${exchange.id} 未检测到 ${autoExchangeAddress} 收到 ${exchange.from_address} USDT 的转账（允许±${AMOUNT_TOLERANCE}误差），跳过`,
        );
        continue;
      }

      // 检查 payment 是否已经有 txHash，防止重复处理
      if (exchange.hash && exchange.hash === matchedTransfer.trade_id) {
        console.log(
          `[checkPendingExchanges] 兑换记录 ${exchange.id} 已处理过该转账哈希，跳过`,
        );
        continue;
      }

      if (!exchange.isTransferIntoOther) {
        exchange.to_address = matchedTransfer.from_address;
        await exchange.save();
      }

      const txid = await sendTRX(
        bot.private_key,
        exchange.to_address,
        exchange.to_amount,
      );

      if (!txid) {
        console.error(
          `[checkPendingExchanges] 兑换记录 ${exchange.id} 发送 TRX 失败`,
        );
        exchange.status = 'failed';
        await exchange.save();
        continue;
      }

      // exchange更新
      exchange.status = 'completed';
      exchange.hash = txid;
      await exchange.save();

      // 发送支付成功通知
      const telegramBot = setupBot(bot.token);

      try {
        await telegramBot.api.sendMessage(
          botUser.id,
          [
            `✅ 兑换成功！\n\n`,
            `📝 兑换记录: <code>${exchange.id}</code>\n`,
            `💰 兑换金额: ${exchange.from_amount} USDT\n`,
            `💰 兑换后金额: ${exchange.to_amount}\n`,
            `⏰ 兑换时间: ${formatBeijingDate(exchange.createdAt)}\n`,
            `🙏 感谢您的兑换！`,
          ].join('\n'),
          { parse_mode: 'HTML' },
        );
        console.log(
          `[checkPendingExchanges] 已通知用户 ${botUser.id} 支付成功`,
        );
      } catch (msgErr) {
        console.error(
          `[checkPendingExchanges] 通知用户 ${botUser.id} 失败:`,
          msgErr,
        );
      }

      console.log(
        `[checkPendingExchanges] 已为兑换记录 ${exchange.id} 生成兑换记录，兑换ID: ${exchange.id}`,
      );
    }

    console.log('[checkPendingExchanges] 待处理兑换记录处理完成');
  } catch (error) {
    console.error('[checkPendingExchanges] 处理待处理兑换记录时出错:', error);
  }
}
