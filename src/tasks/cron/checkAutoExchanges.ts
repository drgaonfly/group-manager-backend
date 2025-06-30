// src/cron/expiredExchanges.ts
import Exchange from '../../models/exchange';
import Bot from '../../models/bot';
import { sendTRX } from '../../utils/sendTRX';
import { decrypt } from '../../services/encrypt';
import { getUSDTTransfers } from '../../services/checkUsdt';
import { fetchTrxUsdtPrice } from '../../bot/commands/user/exchange/realtiem';
import { IdGen } from '../../utils/idGen';

export async function checkAutoExchanges() {
  console.log('[checkAutoExchanges] 开始检查自动兑换...');
  const currentPrice = await fetchTrxUsdtPrice();
  console.log('[checkAutoExchanges] 当前 TRX/USDT 汇率:', currentPrice);

  try {
    const bots = await Bot.find({ isOnline: true });
    console.log(`[checkAutoExchanges] 共找到 ${bots.length} 个在线机器人`);

    for (const bot of bots) {
      try {
        console.log(
          `[checkAutoExchanges] 处理 bot: ${bot.id} (${bot.userName || ''})`,
        );
        if (!bot.auto_exchange_address) {
          console.log(
            '[checkAutoExchanges] bot',
            bot.id,
            '没有设置自动兑换地址，跳过',
          );
          continue;
        }

        const transfers = await getUSDTTransfers(bot.auto_exchange_address);
        console.log(
          `[checkAutoExchanges] bot ${bot.id} 收到 ${transfers.length} 条转账记录`,
        );

        // 筛选出转入的交易
        // 只查入账的
        const filteredTransfers = transfers.filter(
          (transfer) =>
            transfer.to_address === bot.auto_exchange_address &&
            transfer.from_address !== bot.auto_exchange_address,
        );

        console.log(
          `[checkAutoExchanges] bot ${bot.id} 筛选出 ${filteredTransfers.length} 条转入交易`,
        );
        if (filteredTransfers.length > 0) {
          filteredTransfers.forEach((t, idx) => {
            console.log(
              `[checkAutoExchanges] 转入交易[${idx}]: trade_id=${t.trade_id}, from=${t.from_address}, to=${t.to_address}, money=${t.money}`,
            );
          });
        }

        // 只处理那些 trade_id 在 Exchange 表中不存在的转账
        // 先查出所有已存在的 trade_id
        const existingExchanges = await Exchange.find({
          status: 'completed',
          hash: { $ne: null },
        }).select('hash');

        const existingHashes = new Set(existingExchanges.map((e) => e.hash));

        const deepFilteredTransfers = filteredTransfers.filter(
          (transfer) =>
            transfer.trade_id && !existingHashes.has(transfer.trade_id),
        );

        console.log(
          `[checkAutoExchanges] bot ${bot.id} 有 ${deepFilteredTransfers.length} 条新转账待处理`,
        );

        for (const transfer of deepFilteredTransfers) {
          try {
            console.log(
              `[checkAutoExchanges] 处理转账 trade_id=${transfer.trade_id}, 金额=${transfer.money}, from=${transfer.from_address}`,
            );
            // 计算实际汇率和兑换的 TRX 数量
            const realPrice = currentPrice * (1 - bot.fee / 100);
            const trxAmount = transfer.money * realPrice;
            console.log(
              `[checkAutoExchanges] 实际汇率: ${realPrice}, 兑换 TRX 数量: ${trxAmount}`,
            );

            const newId = await IdGen.next(Exchange, 'id', 6);
            console.log(`[checkAutoExchanges] 生成新兑换记录 id=${newId}`);

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

            console.log(
              `[checkAutoExchanges] 已创建兑换记录 id=${exchange.id}, hash=${exchange.hash}`,
            );

            // 发起 TRX 转账
            let txid = '';
            try {
              console.log(
                `[checkAutoExchanges] 正在发送 TRX: ${trxAmount} 到 ${exchange.receive_address}`,
              );
              txid = await sendTRX(
                decrypt(bot.private_key),
                exchange.receive_address,
                exchange.to_amount,
              );
              console.log(`[checkAutoExchanges] TRX 发送成功, txid=${txid}`);
            } catch (sendErr) {
              console.error(`[checkAutoExchanges] 发送 TRX 失败:`, sendErr);
              // 这里可以考虑更新兑换状态为失败
              continue;
            }

            exchange.txid = txid;
            await exchange.save();
            console.log(
              `[checkAutoExchanges] 兑换记录 id=${exchange.id} 已保存, txid=${txid}`,
            );
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
    console.log('[checkAutoExchanges] 兑换记录处理完成');
  } catch (error) {
    console.error('[checkAutoExchanges] 处理兑换记录时出错:', error);
  }
}
