import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import Wallet from '../../../../models/wallet';
import createBug from 'debug';
import { getUSDTTransfers } from '../../../../services/checkUsdt';

// 弃用

const exchangeMainMenuComposer = new Composer<MyContext>();

const debug = createBug('bot:exchange:main menu');

exchangeMainMenuComposer.callbackQuery('exchange_main', async (ctx) => {
  debug('exchange_main');

  const wallets = await Wallet.find({
    botUser: ctx.currentBotUser._id,
    bot: ctx.currentBot._id,
  });

  const trx_balance = wallets.reduce(
    (acc, wallet) => acc + wallet.usdt_balance,
    0,
  );

  const transfers = await getUSDTTransfers(ctx.currentBotUser.id);

  const usdt_balance = transfers.reduce(
    (acc, transfer) => acc + transfer.money,
    0,
  );

  const message = [
    `💬 用户名: @${ctx.currentBotUser.userName}`,
    `👤用户电报ID: <code>${ctx.currentBotUser.id}</code>`,
    `💰 USDT: <code>${usdt_balance.toFixed(4)}</code>`,
    `💰 TRX: <code>${trx_balance.toFixed(4)}</code>`,
    '\n',
    '请绑定个人钱包，方便预支，以及接收兑换和能量等通知！',
  ].join('\n');

  const inline_menu = new InlineKeyboard()
    .text('充值', 'recharge_trx')
    .text('红包功能', 'red_packet')
    .row()
    .text('转账', 'transfer')
    .text('收钱', 'receive')
    .row()
    .text('余额闪兑', 'exchange_flash')
    .text('开通会员', 'be_vip');

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: inline_menu,
  });
});

export default exchangeMainMenuComposer;
