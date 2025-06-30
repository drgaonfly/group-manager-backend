// src/cron/expiredExchanges.ts
import Exchange from '../../models/exchange';
import Bot from '../../models/bot';
import { sendTRX } from '../../utils/sendTRX';
import { decrypt } from '../../services/encrypt';
import { getUSDTTransfers } from '../../services/checkUsdt';
import { fetchTrxUsdtPrice } from '../../bot/commands/user/exchange/realtiem';
import { IdGen } from '../../utils/idGen';

export async function checkAutoExchanges() {
  const currentPrice = await fetchTrxUsdtPrice();

  try {
    const bots = await Bot.find({ isOnline: true });

    for (const bot of bots) {
      try {
        if (!bot.auto_exchange_address) {
          console.log('[updateExchange] bot', bot.id, '没有设置自动兑换地址');
          continue;
        }

        const transfers = await getUSDTTransfers(bot.auto_exchange_address);
        console.log('[updateExchange] transfers', transfers.length);

        // 筛选出转入的交易
        const filteredTransfers = transfers.filter(
          (transfer) => transfer.to_address === bot.auto_exchange_address,
        );

        console.log('filteredTransfers', filteredTransfers);

        // 筛选出Exchange里未有的trade_id的记录
        const exchanges = await Exchange.find({
          status: 'completed',
          hash: { $ne: null },
        });

        const deepFilteredTransfers = filteredTransfers.filter((transfer) =>
          exchanges.find((exchange) => exchange.hash !== transfer.trade_id),
        );

        for (const transfer of deepFilteredTransfers) {
          try {
            // 计算实际汇率和兑换的 TRX 数量
            const realPrice = currentPrice * (1 - bot.fee / 100);
            const trxAmount = transfer.money * realPrice;

            const newId = await IdGen.next(Exchange, 'id', 6);

            // 创建已支付的兑换记录
            const exchange = await Exchange.create({
              id: newId,
              bot: bot._id,
              from_address: bot.auto_exchange_address,
              to_address: transfer.from_address,
              receive_address: transfer.from_address,
              from_amount: transfer.money,
              to_amount: trxAmount, // 计算兑换的 TRX 数量
              rate: realPrice, // 设置实际汇率
              fee: bot.fee,
              status: 'completed',
              hash: transfer.trade_id,
              isTransferIntoOther: false,
            });

            const txid = await sendTRX(
              decrypt(bot.private_key),
              exchange.receive_address,
              exchange.to_amount,
            );

            exchange.txid = txid;
            await exchange.save();
          } catch (err) {
            console.error('[checkAutoExchanges] 处理兑换记录时出错:', err);
            continue;
          }
        }
      } catch (botErr) {
        console.error('[checkAutoExchanges] 处理 bot 时出错:', botErr);
        continue;
      }
    }
    console.log('[updateExchange] 兑换记录处理完成');
  } catch (error) {
    console.error('处理兑换记录时出错:', error);
  }
}
