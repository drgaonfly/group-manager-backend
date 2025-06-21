// src/cron/expiredExchanges.ts
import Exchange from '../../models/exchange';
import BotUser from '../../models/botUser';
import Bot from '../../models/bot';
import { setupBot } from '../../bot/botSetup';
import { getUSDTTransfers } from '../../services/checkTrx';
import { formatBeijingDate } from '../../utils/formatBeijingDate';
import { sendTRX } from '../../utils/sendTRX';

export async function checkPendingExchangesForSelf() {
  try {
    const bots = await Bot.find();

    for (const bot of bots) {
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

      for (const transfer of filteredTransfers) {
        const exchanges = await Exchange.find({
          hash: null,
          status: 'temporary',
          isTransferIntoOther: false,
        });

        for (const exchange of exchanges) {
          if (exchange.from_amount === transfer.money) {
            const tx = await sendTRX(
              bot.private_key,
              transfer.from_address,
              exchange.to_amount,
            );

            //  const tx = '假设成功了'

            if (tx) {
              exchange.hash = transfer.trade_id;
              exchange.status = 'completed';
              exchange.to_address = transfer.from_address;

              await exchange.save();

              const telegramBot = setupBot(bot.token);

              const botUser = await BotUser.findById(exchange.botUser);

              await telegramBot.api.sendMessage(
                botUser.id,
                [
                  `兑换记录 <code>${exchange.id}</code> 已支付，请注意查收。`,
                  `兑换金额：${exchange.from_amount} USDT`,
                  `兑换到账：${exchange.to_amount} TRX`,
                  `发送地址: ${exchange.from_address}`,
                  `接收地址: ${exchange.to_address}`,
                  `兑换时间：${formatBeijingDate(transfer.time)}`,
                ].join('\n'),
                { parse_mode: 'HTML' },
              );
            }
          }
        }
      }
    }
    console.log('[updateExchange] 兑换记录处理完成');
  } catch (error) {
    console.error('处理兑换记录时出错:', error);
  }
}
