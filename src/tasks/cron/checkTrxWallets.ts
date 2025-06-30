import Bot from '../../models/bot';
import { setupBot } from '../../bot/botSetup';
import BotUser from '../../models/botUser';
import Wallet from '../../models/wallet';
import { getTrxTransfers } from '../../services/checkTrx';
import { formatBeijingDate } from '../../utils/formatBeijingDate';
import { IdGen } from '../../utils/idGen';
import Receipt from '../../models/receipt';
import axios from 'axios';

/**
 * 检查所有钱包的 TRX 主币转账记录，识别转入/转出并通知用户。
 */
export async function checkTrxWallets() {
  try {
    console.log('[checkTrxWallets] 开始检查 TRX 转账...');

    const wallets = await Wallet.find({ isOnline: true })
      .populate('botUser')
      .populate('bot');

    console.log(`[checkTrxWallets] 共找到 ${wallets.length} 个在线钱包`);

    for (const wallet of wallets) {
      const botUser = await BotUser.findById(wallet.botUser);
      const bot = await Bot.findById(wallet.bot);
      const address = wallet.address;
      const telegramBot = setupBot(bot.token);

      let transfers = [];
      try {
        transfers = await getTrxTransfers(address);
      } catch (err) {
        console.error(`[checkTrxWallets] 获取地址 ${address} 的转账失败:`, err);
        continue;
      }

      for (const transfer of transfers) {
        if (!transfer.money) continue;

        const isHandled = await Receipt.exists({
          hash: transfer.trade_id,
          bot: bot._id,
          botUser: botUser._id,
        });
        if (isHandled) {
          console.log(
            `[checkTrxWallets] 已处理转账 ${transfer.trade_id}，跳过`,
          );
          continue;
        }

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
          crypto_type: 'trx',
        });

        // 更新余额
        try {
          const response = await axios.get(
            `https://apilist.tronscan.org/api/account?address=${wallet.address}`,
          );

          const trxBalance = (response.data.balance / 1_000_000).toFixed(8);
          const usdtToken = response.data.trc20token_balances?.find(
            (token: any) => token.tokenAbbr === 'USDT',
          );
          const usdtBalance = usdtToken ? usdtToken.balance / 1_000_000 : 0;

          wallet.trx_balance = Number(trxBalance);
          wallet.usdt_balance = Number(usdtBalance);
          await wallet.save();
        } catch (err) {
          console.warn(`[checkTrxWallets] 获取余额失败:`, err);
        }

        const balanceChange = `${isIncome ? '+' : '-'}${transfer.money.toFixed(
          8,
        )} TRX`;

        const message = [
          `<b>📣余额变化: ${balanceChange}</b>`,
          '',
          `⏰交易时间: ${formatBeijingDate(receipt.time * 1000)}`,
          `🔗所属公链: Tron`,
          `💰监听地址: <code>${address}</code>`,
          `💰${isIncome ? '来源' : '目标'}地址: <code>${
            isIncome ? transfer.from_address : transfer.to_address
          }</code>`,
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
          console.error(`[checkTrxWallets] 通知用户 ${botUser.id} 失败:`, err);
        }
      }
    }

    console.log('[checkTrxWallets] TRX 转账检查完成');
  } catch (error) {
    console.error('[checkTrxWallets] 执行异常:', error);
  }
}
