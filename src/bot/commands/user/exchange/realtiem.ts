import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import createBug from 'debug';
import axios from 'axios';
import Exchange from '../../../../models/exchange';
import { IdGen } from '../../../../utils/idGen';

const exchangeRealtiemComposer = new Composer<MyContext>();
const debug = createBug('bot:exchange');

// Add global price variable
let currentPrice: number | null = null;

// Add price fetching function
async function fetchPrice() {
  try {
    const response = await axios.get(
      'https://openapi.sun.io/v2/allpairs?page_size=1&page_num=0&token_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t&orderBy=price',
    );
    currentPrice =
      response.data.data['0_TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'].price;
    debug('Price updated:', currentPrice);
  } catch (error) {
    debug('Error fetching price:', error);
  }
}

// Initialize price on module load
fetchPrice();

// Set up timer to update price every minute
setInterval(fetchPrice, 60000);

exchangeRealtiemComposer.hears(/^(\d+(?:\.\d+)?)[ ]*u$/i, async (ctx) => {
  const match = ctx.message?.text.split(' ');

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

  const realPrice = currentPrice * (1 - ctx.currentBot.fee / 100);
  const usdtAmount = parseFloat(match[0]);
  const trxAmount = usdtAmount * realPrice;

  await Exchange.create({
    id: await IdGen.next(Exchange, 'id', 6),
    bot: ctx.currentBot._id,
    botUser: ctx.currentBotUser._id,
    from_address: ctx.currentBot.auto_exchange_address,
    to_address: ' ',
    from_amount: usdtAmount,
    to_amount: trxAmount,
    rate: realPrice,
    fee: ctx.currentBot.fee,
    status: 'temporary',
    isTransferIntoOther: false,
  });

  await ctx.reply(
    [
      `<b>实时汇率：</b>`,
      `${usdtAmount} USDT = ${trxAmount} TRX`,
      `\n`,
      `<b>自动兑换地址：</b>`,
      `<code>${
        ctx.currentBot.auto_exchange_address || '请在后台设置机器人收款地址'
      }</code> (点击地址自动复制)`,
      `\n`,
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('❌ 关闭', 'close'),
    },
  );
});

export default exchangeRealtiemComposer;
