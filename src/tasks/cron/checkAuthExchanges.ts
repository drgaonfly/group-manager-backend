// src/cron/expiredExchanges.ts
import Exchange from '../../models/exchange';
import Bot from '../../models/bot';
import { getUSDTTransfers } from '../../services/checkUsdt';
import { fetchTrxUsdtPrice } from '../../bot/commands/user/exchange/realtiem';

export async function checkAuthExchanges() {
  const currentPrice = await fetchTrxUsdtPrice();

  try {
    const bots = await Bot.find({ isOnline: true });

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
        // 计算实际汇率和兑换的 TRX 数量
        const realPrice = currentPrice * (1 - bot.fee / 100);
        const trxAmount = transfer.money * realPrice;

        // 创建已支付的兑换记录
        await Exchange.create({
          bot: bot._id,
          from_address: bot.auto_exchange_address,
          to_address: transfer.from_address,
          receive_address: transfer.from_address,
          from_amount: transfer.money,
          to_amount: trxAmount, // 计算兑换的 TRX 数量
          rate: realPrice, // 设置实际汇率
          fee: bot.fee,
          status: 'paid',
          hash: transfer.trade_id,
          isTransferIntoOther: false,
        });

        // const telegramBot = setupBot(bot.token);

        // // 查找该用户（如果有绑定）
        // let botUser = null;
        // if (exchange.botUser) {
        //   botUser = await BotUser.findById(exchange.botUser);
        // }

        // // 发送消息给用户（如果有用户）
        // if (botUser) {
        //   await telegramBot.api.sendMessage(
        //     botUser.id,
        //     [
        //       `兑换记录 <code>${exchange.id}</code> 已收到付款，订单已标记为已支付。`,
        //       `兑换金额：${exchange.from_amount} USDT`,
        //       `兑换到账：${exchange.to_amount ?? '待处理'} TRX`,
        //       `发送地址: ${exchange.from_address}`,
        //       `接收地址: ${exchange.to_address}`,
        //       `兑换时间：${formatBeijingDate(transfer.time)}`,
        //     ].join('\n'),
        //     { parse_mode: 'HTML' },
        //   );
        // }
      }
    }
    console.log('[updateExchange] 兑换记录处理完成');
  } catch (error) {
    console.error('处理兑换记录时出错:', error);
  }
}
