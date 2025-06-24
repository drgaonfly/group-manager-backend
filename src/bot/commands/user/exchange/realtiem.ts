import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import createBug from 'debug';
import axios from 'axios';
import Exchange from '../../../../models/exchange';
import { IdGen } from '../../../../utils/idGen';
import { formatBeijingDate } from '../../../../utils/formatBeijingDate';

const exchangeRealtiemComposer = new Composer<MyContext>();
const debug = createBug('bot:exchange');

let trxAmount: number;
let usdtAmount: number;
let realPrice: number;

// Add price fetching function
export async function fetchTrxUsdtPrice() {
  try {
    const response = await axios.get(
      'https://openapi.sun.io/v2/allpairs?page_size=1&page_num=0&token_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t&orderBy=price',
    );
    const currentPrice =
      response.data.data['0_TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'].price;
    debug('Price updated:', currentPrice);
    return currentPrice;
  } catch (error) {
    debug('Error fetching price:', error);
    return null;
  }
}

exchangeRealtiemComposer.hears(/^(\d+(?:\.\d+)?)[ ]*u$/i, async (ctx) => {
  const match = ctx.message?.text.split(' ');

  const currentPrice = await fetchTrxUsdtPrice();

  if (!currentPrice) {
    await ctx.reply('抱歉，暂时无法获取价格信息，请稍后再试。');
    return;
  }

  if (!ctx.currentBot.fee) {
    await ctx.reply('机器人没有设置手续费，请在后台设置');
    return;
  }

  if (!ctx.currentBot.auto_exchange_address) {
    await ctx.reply('机器人没有设置自动兑换地址，请在后台设置');
    return;
  }

  realPrice = currentPrice * (1 - ctx.currentBot.fee / 100);
  usdtAmount = parseFloat(match[0]);
  trxAmount = usdtAmount * realPrice;

  await ctx.reply(
    [
      `请确认兑换信息`,
      `\n`,
      `接收地址：<code>${
        ctx.currentBot.auto_exchange_address || '请在后台设置机器人收款地址'
      }</code>`,
      `\n`,
      `支付币种：${usdtAmount} USDT`,
      `\n`,
      `接收币种：${trxAmount} TRX`,
      `\n`,
      `请点击确认继续，或取消操作`,
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('✅ 确认生成订单', 'confirm_transfer_second')
        .text('❌ 取消', 'close')
        .row(),
    },
  );
});

exchangeRealtiemComposer.callbackQuery(
  'confirm_transfer_second',
  async (ctx) => {
    const id = await IdGen.next(Exchange, 'id', 6);

    const exchange = await Exchange.create({
      id,
      bot: ctx.currentBot._id,
      botUser: ctx.currentBotUser._id,
      from_address: ctx.currentBot.auto_exchange_address,
      from_amount: usdtAmount,
      to_amount: trxAmount,
      rate: realPrice,
      fee: ctx.currentBot.fee,
      status: 'pending',
      isTransferIntoOther: false,
      expiredAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    await ctx.reply(
      [
        `<b>💰订单创建成功💰</b>`,
        `\n`,
        `机器人收U钱包(单击下方地址自动复制): `,
        `<code>${ctx.currentBot.auto_exchange_address}</code>`,
        `\n`,
        `请在 ${formatBeijingDate(exchange.expiredAt)} 之前(10分钟内)转账付款`,
      ].join('\n'),
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text(
          `取消订单`,
          `cancel_exchange_${id}`,
        ),
      },
    );
  },
);

export default exchangeRealtiemComposer;
