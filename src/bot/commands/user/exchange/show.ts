import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import axios from 'axios';
import createBug from 'debug';

const exchangeShowComposer = new Composer<MyContext>();

const debug = createBug('bot:exchange');

const handleShow = async (ctx: MyContext) => {
  const response = await axios.get(
    'https://openapi.sun.io/v2/allpairs?page_size=1&page_num=0&token_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t&orderBy=price',
  );

  debug(response.data);

  const result = response.data.data['0_TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'];

  const trx_balance = ctx.currentBotUserConfig.trx_balance;

  const message = [
    `📈实时汇率`,
    `1 USDT = ${result.price} TRX   目前库存: ${trx_balance} TRX`,
    '\n',
    '<b>自动兑换地址</b>',
    `<code>${result.base_id}</code>(点击地址自动复制)`,
    '\n',
    '🚫请不要使用交易所或中心化钱包转账❗️切记‼️',
    '🏪转账即兑,全自动返,等值1U起兑，全网最高汇率',
    'U→TRX 即转即兑',
    '\n',
    '输入钱包地址,可以查余额',
    '\n',
    '📌<b>请输入兑换数量,例如:“20U”</b>',
  ].join('\n');

  const inline_menu = new InlineKeyboard()
    .text('🔄 兑换给他人', 'exchange_to_others')
    .text('💱 余额闪兑换', 'exchange_flash')
    .row()
    .url('大额联系老板', ctx.currentBot.contact || 'https://t.me/aodi93');

  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: inline_menu,
  });
};

exchangeShowComposer.hears(/^💱 TRX 兑换$/, async (ctx) => {
  await handleShow(ctx);
});

exchangeShowComposer.callbackQuery('exchange_show', async (ctx) => {
  await handleShow(ctx);
});

export default exchangeShowComposer;
