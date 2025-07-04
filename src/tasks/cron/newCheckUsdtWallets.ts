import Bot from '../../models/bot';
import { setupBot } from '../../bot/botSetup';
import BotUser from '../../models/botUser';
import Wallet from '../../models/wallet';
import { formatBeijingDate } from '../../utils/formatBeijingDate';
import { IdGen } from '../../utils/idGen';
import Receipt from '../../models/receipt';
import {
  fetchTrc20Transactions,
  getAccountBalances,
} from '../../utils/fetchTransactions';

/**
 * 检查所有钱包的USDT转账记录，包括转入和转出。
 * 根据from_address和to_address判断交易类型。
 * 向用户发送详细的交易通知。
 */
export async function newCheckUsdtWallets() {
  try {
    console.log('[checkTransferIn] 开始检查转账...');

    const wallets = await Wallet.find({
      isOnline: true,
    })
      .populate('botUser')
      .populate('bot');

    console.log(`[checkTransferIn] 查询到 ${wallets.length} 个在线的钱包`);

    for (const wallet of wallets) {
      const botUser = await BotUser.findById(wallet.botUser);
      const bot = await Bot.findById(wallet.bot);
      const address = wallet.address;
      const telegramBot = setupBot(bot.token);

      // 查询该地址近5天的USDT转账
      let transfers;

      try {
        const response = await fetchTrc20Transactions(address);

        // console.log('response', response);

        transfers = response
          .filter((tx) => tx.token_info?.symbol === 'USDT')
          .map((tx) => ({
            hash: tx.transaction_id,
            from_address: tx.from,
            to_address: tx.to,
            money: Number(tx.value) / 1_000_000,
            time: Math.floor(tx.block_timestamp / 1000),
          }));
      } catch (err) {
        console.error(
          `[checkTransferIn] 获取地址 ${address} 转账记录失败:`,
          err,
        );
        continue;
      }

      console.log('transfers', transfers);

      // 检查每一笔转账
      for (const transfer of transfers) {
        if (!transfer.money) continue;

        // 线上，只处理交易时间大于创建时间的转账
        if (process.env.NODE_ENV === 'production') {
          if (transfer.time < wallet.createdAt.getTime() / 1000) {
            continue;
          }
        }

        // 检查是否已处理过该转账
        if (
          transfer.hash &&
          (await Receipt.exists({
            hash: transfer.hash,
            bot: bot._id,
            botUser: botUser._id,
          }))
        ) {
          console.log(
            `[checkTransferIn] 钱包 ${wallet.address} 已处理过该转账哈希，跳过`,
          );
          continue;
        }

        // 判断交易类型
        const isIncome = transfer.to_address === address;

        const receipt = await Receipt.create({
          id: await IdGen.next(Receipt, 'id', 6),
          type: isIncome ? 'transferIn' : 'transferOut',
          wallet: wallet._id,
          amount: transfer.money,
          hash: transfer.hash,
          bot: bot._id,
          botUser: botUser._id,
          time: transfer.time,
          from_address: transfer.from_address,
          to_address: transfer.to_address,
          crypto_type: 'usdt',
        });

        // 计算余额变化
        const amount = Number(transfer.money) || 0;
        const balanceChange = `${isIncome ? '+' : '-'}${amount.toFixed(
          8,
        )} USDT`;

        const response = await getAccountBalances(address);

        console.log('余额变化', response);

        const trxBalance = response.trxBalance;
        const usdtBalance = response.usdtBalance;

        wallet.trx_balance = Number(trxBalance);
        wallet.usdt_balance = Number(usdtBalance);
        await wallet.save();

        const message = [
          `<b>📣余额变化: ${balanceChange}</b>`,
          `\n`,
          `⏰交易时间: ${formatBeijingDate(receipt.time * 1000)}`,
          `🔗所属公链: Tron`,
          `💰监听地址: <code>${address}</code>`,
          `💰${isIncome ? '来源' : '目标'}地址: <code>${
            isIncome ? transfer.from_address : transfer.to_address
          }</code>`,
          `${isIncome ? '🟢' : '🔴'}交易类型: ${isIncome ? '转入' : '转出'}`,
          `💸交易金额: ${receipt.amount} USDT`,
          `💸TRX余额: ${wallet.trx_balance} TRX`,
          `💸USDT余额: ${wallet.usdt_balance} USDT`,
        ].join('\n');

        try {
          await telegramBot.api.sendMessage(botUser.id, message, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '查看详情',
                    url: `https://tronscan.org/#/transaction/${receipt.hash}`,
                  },
                ],
              ],
            },
          });
        } catch (err) {
          console.error(`[checkTransferIn] 通知用户 ${botUser.id} 失败:`, err);
        }
      }
    }

    console.log('[checkTransferIn] 转账处理完成');
  } catch (error) {
    console.error('[checkTransferIn] 处理转账时出错:', error);
  }
}
