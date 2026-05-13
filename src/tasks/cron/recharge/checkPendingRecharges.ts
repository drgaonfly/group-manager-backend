import Recharge from '../../../models/recharge';
import BotUser, { IBotUser } from '../../../models/botUser';
import { IBot } from '../../../models/bot';
import { setupBot } from '../../../bot/botSetup';
import { fetchTrc20Transactions } from '../../../utils/fetchTransactions';
import { formatBeijingDate } from '../../../utils/formatBeijingDate';
import { InlineKeyboard } from 'grammy';
import BotUserConfig from '../../../models/botUserConfig';
import Group from '../../../models/group';
import createDebug from 'debug';
const debug = createDebug('cron:checkPendingRecharges');

/**
 * 检查所有 pending 的充值订单，只有当 bot.trx20_address 收到正确金额，才为用户充值
 */
export async function checkPendingRecharges() {
  try {
    console.log('[checkPendingRecharges] 开始检查所有待处理的充值订单...');

    // 查询所有待处理的充值订单
    const pendingRecharges = await Recharge.find({
      status: 'pending',
    })
      .populate('botUser')
      .populate('bot');

    console.log(
      `[checkPendingRecharges] 查询到 ${pendingRecharges.length} 个待处理的充值订单`,
    );

    for (const recharge of pendingRecharges) {
      // 检查 bot 是否有 trx20_address
      const botUser = recharge.botUser as IBotUser;
      const bot = recharge.bot as IBot;
      const receiveAddress = bot.trx20_address || recharge.to;
      if (!receiveAddress) {
        console.warn(
          `[checkPendingRecharges] 订单 ${recharge.id} 的机器人未设置收款地址，跳过`,
        );
        continue;
      }

      const response = await fetchTrc20Transactions(receiveAddress, 1);

      console.log('origin', response[0]);

      console.log(
        `[checkPendingRecharges] bot ${bot.id} 收到 ${response.length} 条转账记录`,
      );

      // 官方 USDT TRC20 合约地址（主网固定不变）
      const OFFICIAL_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
      const transfers = response
        .filter(
          (tx) =>
            tx.token_info?.symbol === 'USDT' &&
            tx.token_info.address === OFFICIAL_USDT_CONTRACT &&
            tx.type === 'Transfer',
        )
        .map((tx) => ({
          trade_id: tx.transaction_id,
          from_address: tx.from,
          to_address: tx.to,
          money: Number(tx.value) / 1_000_000,
          time: Math.floor(tx.block_timestamp / 1000),
          contract_address: tx.token_info.address.toLowerCase(),
        }));

      // 只接收转入的 且 满足 正确的合约地址
      const filteredTransfers = transfers.filter(
        (transfer) =>
          transfer.to_address === receiveAddress &&
          transfer.from_address !== receiveAddress &&
          transfer.contract_address === OFFICIAL_USDT_CONTRACT.toLowerCase(),
      );

      console.log('filteredTransfers', filteredTransfers.length);

      // 查找是否有金额和订单匹配的转账
      // 允许0.001 USDT的误差（处理不同平台的小数精度差异）
      const AMOUNT_TOLERANCE = 0.001;
      const matchedTransfer = filteredTransfers.find(
        (t) =>
          Math.abs(t.money - recharge.amount) <= AMOUNT_TOLERANCE &&
          t.time * 1000 > recharge.createdAt.getTime(),
      );

      if (!matchedTransfer) {
        console.log(
          `[checkPendingRecharges] 订单 ${recharge.id} 未检测到 ${receiveAddress} 收到 ${recharge.amount} USDT 的转账（允许±${AMOUNT_TOLERANCE}误差），跳过`,
        );
        continue;
      }

      // 检查 recharge 是否已经有 txHash，防止重复处理
      if (recharge.txHash && recharge.txHash === matchedTransfer.trade_id) {
        console.log(
          `[checkPendingRecharges] 订单 ${recharge.id} 已处理过该转账哈希，跳过`,
        );
        continue;
      }

      // 充值到账，更新用户余额
      const config = await BotUserConfig.findOne({
        bot: bot._id,
        botUser: botUser._id,
      });

      // 更新 recharge 状态
      recharge.usdt_balance_after =
        recharge.usdt_balance_before + recharge.amount;
      recharge.status = 'paid';
      recharge.txHash = matchedTransfer.trade_id;
      recharge.from = matchedTransfer.from_address;
      recharge.transactionAt = new Date(matchedTransfer.time * 1000);
      await recharge.save();

      config.usdt_balance += recharge.amount;
      await config.save();

      // 发送支付成功通知
      const telegramBot = setupBot(bot.token);

      try {
        await telegramBot.api.sendMessage(
          botUser.id,
          `✅ 充值成功！\n\n` +
            `订单号：<code>${recharge.id}</code>\n` +
            `充值金额：<b>${recharge.amount} USDT</b>\n` +
            `实际到账：<b>${matchedTransfer.money} USDT</b>\n` +
            `现有余额：<b>${config.usdt_balance} USDT</b>\n\n` +
            `感谢您的充值！`,
          { parse_mode: 'HTML' },
        );

        console.log(
          `[checkPendingRecharges] 已通知用户 ${botUser.id} 充值成功`,
        );

        // 群播报
        const groups = await Group.find({
          bot: bot._id,
        });

        debug('群播报', { groups });

        for (const group of groups) {
          await telegramBot.api.sendMessage(
            group.id,
            [
              `✅ 成功充值`,
              '\n',
              `🔸买家 ID： <code>${botUser.displayName.replace(
                /^(.{2}).*(.{2})$/,
                '$1****$2',
              )}</code>`,
              `🔸充值编号： <code>${recharge.id}</code>`,
              `🔸充值金额： ${recharge.amount.toFixed(3)} USDT`,
              `🔸到账金额： ${matchedTransfer.money.toFixed(3)} USDT`,
              `🔸充值日期： ${formatBeijingDate(recharge.createdAt)}`,
              `\n📣 您也可以点击下方按钮购买号码。`,
            ].join('\n'),
            {
              parse_mode: 'HTML',
              reply_markup: new InlineKeyboard()
                .url('自助取号机器人🤖', `https://t.me/${bot.userName}`)
                .row(),
            },
          );
        }

        // 通知机器人主人
        const owners = await BotUser.find({
          _id: { $in: bot.owners },
        });

        if (owners && owners.length > 0) {
          for (const owner of owners) {
            try {
              await telegramBot.api.sendMessage(
                owner.id,
                [
                  `💰 收到新充值`,
                  '\n',
                  `🔸买家： <code>${botUser.displayName}</code>`,
                  `🔸买家 ID： <code>${botUser.id}</code>`,
                  `🔸充值编号： <code>${recharge.id}</code>`,
                  `🔸充值金额： ${recharge.amount.toFixed(3)} USDT`,
                  `🔸实际到账： ${matchedTransfer.money.toFixed(3)} USDT`,
                  `🔸充值日期： ${formatBeijingDate(recharge.createdAt)}`,
                  `🔸交易哈希： <code>${matchedTransfer.trade_id}</code>`,
                ].join('\n'),
                { parse_mode: 'HTML' },
              );
              debug(`已通知机器人主人 ${owner.id} 充值成功`);
            } catch (ownerErr) {
              console.error(`通知机器人主人 ${owner.id} 失败:`, ownerErr);
            }
          }
        }
      } catch (msgErr) {
        console.error(
          `[checkPendingRecharges] 通知用户 ${botUser.id} 失败:`,
          msgErr,
        );
      }

      console.log(
        `[checkPendingRecharges] 已为订单 ${recharge.id} 完成充值，到账余额: ${recharge.amount}`,
      );
    }

    console.log('[checkPendingRecharges] 待处理充值订单处理完成');
  } catch (error) {
    console.error('[checkPendingRecharges] 处理待处理充值订单时出错:', error);
  }
}
