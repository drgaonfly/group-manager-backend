import { IBotUser } from '../../models/botUser';
import { IBot } from '../../models/bot';
import { setupBot } from '../../bot/botSetup';
import { fetchTrc20Transactions } from '../../utils/fetchTransactions';
import Exchange from '../../models/exchange';
import { formatBeijingDate } from '../../utils/formatBeijingDate';
import { sendTRX } from '../../utils/sendTRX';
import { decrypt } from '../../services/encrypt';

export async function checkPendingExchanges() {
  try {
    console.log('[checkPendingExchanges] 开始检查所有待处理的兑换记录...');

    const pendingExchanges = await Exchange.find({
      status: 'pending',
      expiredAt: { $gt: new Date() },
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

      const response = await fetchTrc20Transactions(autoExchangeAddress);

      console.log(
        `[checkAutoExchanges] bot ${bot.id} 收到 ${response.length} 条转账记录`,
      );

      const transfers = response
        .filter((tx) => tx.token_info?.symbol === 'USDT')
        .map((tx) => ({
          trade_id: tx.transaction_id,
          from_address: tx.from,
          to_address: tx.to,
          money: Number(tx.value) / 1_000_000,
          time: Math.floor(tx.block_timestamp / 1000),
        }));

      // 只接收转入的
      const filterdTransfers = transfers.filter(
        (t) =>
          t.to_address === autoExchangeAddress &&
          t.from_address !== autoExchangeAddress,
      );

      // 查找是否有金额和订单匹配的转账
      // 允许0.001 USDT的误差（处理不同平台的小数精度差异）
      const AMOUNT_TOLERANCE = 0.001;
      const matchedTransfer = filterdTransfers.find(
        (t) => Math.abs(t.money - exchange.from_amount) <= AMOUNT_TOLERANCE,
      );

      console.log('matchedTransfer', matchedTransfer);

      if (!matchedTransfer) {
        console.log(
          `[checkPendingExchanges] 兑换记录 ${exchange.id} 未检测到 ${autoExchangeAddress} 收到 ${exchange.from_address} USDT 的转账（允许±${AMOUNT_TOLERANCE}误差），跳过`,
        );
        continue;
      }

      // 检查 exchange 是否已经有 txHash，防止重复处理
      if (exchange.hash && exchange.hash === matchedTransfer.trade_id) {
        console.log(
          `[checkPendingExchanges] 兑换记录 ${exchange.id} 已处理过该转账哈希，跳过`,
        );
        continue;
      }

      console.log(
        'matchedTransfer.from_address:',
        matchedTransfer.from_address,
      );

      // if (!exchange.isTransferIntoOther) {
      exchange.to_address = matchedTransfer.from_address;
      await exchange.save();
      // }

      console.log('decrypt(bot.private_key):', decrypt(bot.private_key));

      let txid: string | undefined;
      try {
        txid = await sendTRX(
          decrypt(bot.private_key),
          exchange.receive_address || exchange.to_address,
          exchange.to_amount,
        );
      } catch (err) {
        console.log('err', err);
        console.error(
          `[checkPendingExchanges] 兑换记录 ${exchange.id} 发送 TRX 失败:`,
          err,
        );
        exchange.status = 'failed';
        await exchange.save();
        continue;
      }

      // exchange更新
      exchange.txid = txid;
      exchange.status = 'completed';
      exchange.hash = matchedTransfer.trade_id;
      await exchange.save();

      // 发送支付成功通知
      const telegramBot = setupBot(bot.token);

      try {
        await telegramBot.api.sendMessage(
          botUser.id,
          [
            `✅ 兑换成功！\n\n`,
            `📝 兑换编号: <code>${exchange.id}</code>\n`,
            `💰 转出金额: ${exchange.from_amount} USDT\n`,
            `💰 接收金额: ${exchange.to_amount} TRX\n`,
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
