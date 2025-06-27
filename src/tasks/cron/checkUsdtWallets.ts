import Bot from '../../models/bot';
import { setupBot } from '../../bot/botSetup';
import BotUser from '../../models/botUser';
import Wallet from '../../models/wallet';
import { getUSDTTransfers } from '../../services/checkUsdt';
import { formatBeijingDate } from '../../utils/formatBeijingDate';
import { IdGen } from '../../utils/idGen';
import Receipt from '../../models/receipt';
import axios from 'axios';

/**
 * 检查所有钱包的USDT转账记录，包括转入和转出。
 * 根据from_address和to_address判断交易类型。
 * 向用户发送详细的交易通知。
 */
export async function checkUsdtWallets() {
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
      let transfers: Awaited<ReturnType<typeof getUSDTTransfers>> = [];
      try {
        transfers = await getUSDTTransfers(address);
      } catch (err) {
        console.error(
          `[checkTransferIn] 获取地址 ${address} 转账记录失败:`,
          err,
        );
        continue;
      }

      // 检查每一笔转账
      for (const transfer of transfers) {
        if (!transfer.money) continue;

        // 检查是否已处理过该转账
        if (
          transfer.trade_id &&
          (await Receipt.exists({
            hash: transfer.trade_id,
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
        const isIncome =
          transfer.to_address.toLowerCase() === address.toLowerCase();

        const receipt = await Receipt.create({
          id: await IdGen.next(Receipt, 'id', 6),
          type: isIncome ? 'transferIn' : 'transferOut',
          wallet: wallet._id,
          amount: transfer.money,
          hash: transfer.trade_id,
          bot: bot._id,
          botUser: botUser._id,
          time: transfer.time,
          from_address: transfer.from_address,
          to_address: transfer.to_address,
        });

        // 计算余额变化
        const balanceChange = isIncome
          ? `+${
              transfer.money ? Number(transfer.money).toFixed(4) : '0.0000'
            } USDT`
          : `-${
              transfer.money ? Number(transfer.money).toFixed(4) : '0.0000'
            } USDT`;

        const response = await axios.get(
          `https://apilist.tronscan.org/api/account?address=${wallet.address}`,
        );

        const trxBalance = (response.data.balance / 1_000_000).toFixed(6);
        const usdtToken = response.data.trc20token_balances?.find(
          (token: any) => token.tokenAbbr === 'USDT',
        );
        const usdtBalance = usdtToken ? usdtToken.balance / 1_000_000 : '0';

        wallet.trx_balance = Number(trxBalance);
        wallet.usdt_balance = Number(usdtBalance);
        await wallet.save();

        const message = [
          `<b>📣余额变化: ${balanceChange}</b>`,
          `\n`,
          `⏰交易时间: ${formatBeijingDate(receipt.time * 1000)}`,
          `🔗所属公链: Tron`,
          `💰监听地址: <code>${address}</code>`,
          `💰来源地址: <code>${transfer.from_address}</code>`,
          `${isIncome ? '🟢' : '🔴'}交易类型: ${isIncome ? '转入' : '转出'}`,
          `💸交易金额: ${receipt.amount} TRX`,
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
