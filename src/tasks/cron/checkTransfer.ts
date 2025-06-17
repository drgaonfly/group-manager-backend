import Bot from '../../models/bot';
import { setupBot } from '../../bot/botSetup';
import BotUser from '../../models/botUser';
import Wallet from '../../models/wallet';
import { getUSDTTransfers } from './checkTrx';
import { IdGen } from '../../utils/idGen';
import Receipt from '../../models/receipt';

/**
 * 检查所有已过期的订阅，将其状态设置为 expired。
 * 只有当用户所有订阅都过期时，才将 BotUserConfig 状态更新为 SUBSCRIPTION_EXPIRED。
 * 向用户发送详细的订阅过期通知。
 */
export async function checkTransfer() {
  try {
    console.log('[checkTransfer] 开始检查转账...');

    const wallets = await Wallet.find({
      isOnline: true,
    })
      .populate('botUser')
      .populate('bot');

    console.log(`[checkTransfer] 查询到 ${wallets.length} 个在线的钱包`);

    for (const wallet of wallets) {
      const botUser = await BotUser.findById(wallet.botUser);

      const bot = await Bot.findById(wallet.bot);

      const address = wallet.address;

      // 发送详细的订阅过期通知
      const telegramBot = setupBot(bot.token);

      // 查询该地址近5天的USDT转账
      let transfers: Awaited<ReturnType<typeof getUSDTTransfers>> = [];
      try {
        transfers = await getUSDTTransfers(address);
      } catch (err) {
        console.error(`[checkTransfer] 获取地址 ${address} 转账记录失败:`, err);
        continue;
      }

      const matchedTransfer = transfers.find((t) => t.money);

      // const matchedTransfer = transfers[0]; // 测试用

      if (!matchedTransfer) {
        console.log(
          `[checkTransfer] 钱包 ${wallet.address} 未检测到收到 USDT 的转账，跳过`,
        );
        continue;
      }

      if (
        matchedTransfer.trade_id &&
        (await Receipt.exists({
          hash: matchedTransfer.trade_id,
          bot: bot._id,
          botUser: botUser._id,
        }))
      ) {
        console.log(
          `[checkTransfer] 钱包 ${wallet.address} 已处理过该转账哈希，跳过`,
        );
        continue;
      }

      const receipt = await Receipt.create({
        id: await IdGen.next(Receipt, 'id', 6),
        wallet: wallet._id,
        amount: matchedTransfer.money,
        hash: matchedTransfer.trade_id,
        bot: bot._id,
        botUser: botUser._id,
        time: matchedTransfer.time,
      });

      const message = [
        `🏠监听账户: <code>${address}</code>`,
        `💸交易类型: 🟢收入`,
        `💸交易金额: ${receipt.amount.toFixed(4)} USDT`,
        `⏰交易时间: ${new Date(receipt.time * 1000).toLocaleString()}`,
        `🔗所属公链: Tron`,
        `💰监控地址: <code>${address}</code>`,
        `💰对方地址: <code>${matchedTransfer.buyer}</code>`,
      ].join('\n');

      //

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
        console.error(`[checkTransfer] 通知用户 ${botUser.id} 失败:`, err);
      }
    }

    console.log('[checkTransfer] 转账处理完成');
  } catch (error) {
    console.error('[checkTransfer] 处理转账时出错:', error);
  }
}
