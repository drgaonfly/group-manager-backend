import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import axios from 'axios';
import createBug from 'debug';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { IBot } from '../../../../models/bot';
import Exchange from '../../../../models/exchange';
import { IdGen } from '../../../../utils/idGen';
import { IBotUser } from '../../../../models/botUser';
import { formatBeijingDate } from '../../../../utils/formatBeijingDate';

const exchangeShowComposer = new Composer<MyContext>();

const debug = createBug('bot:exchange');

const TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout

const replyKeyboard = new InlineKeyboard().text('❌ 关闭', 'close');

async function showExchangeConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  {
    bot,
    botUser,
    realPrice,
    base_id,
  }: {
    bot: IBot;
    botUser: IBotUser;
    realPrice: number;
    base_id: string;
  },
) {
  const result = await conversation.waitFor(
    ['message:text', 'callback_query:data'],
    {
      maxMilliseconds: TIMEOUT,
    },
  );

  const { message, callbackQuery } = result;

  if (callbackQuery) {
    const { data } = callbackQuery;
    if (data) {
      await ctx.api.answerCallbackQuery(callbackQuery.id);
      return;
    }
  }

  // Check if the input matches the pattern XU (where X is a number)
  const match = message?.text.match(/^(\d+(?:\.\d+)?)U$/i);
  if (!match) {
    await ctx.reply('❌ 请输入正确的格式，例如: "20U"', {
      parse_mode: 'HTML',
      reply_markup: replyKeyboard,
    });

    return showExchangeConversation(conversation, ctx, {
      bot,
      botUser,
      realPrice,
      base_id,
    });
  }

  const usdtAmount = parseFloat(match[1]);
  const trxAmount = usdtAmount * realPrice;

  const exchange = await Exchange.create({
    id: await IdGen.next(Exchange, 'id', 6),
    bot,
    botUser,
    from_address: bot.auto_exchange_address,
    to_address: ' ',
    from_amount: usdtAmount,
    to_amount: trxAmount,
    rate: realPrice,
    fee: bot.fee,
    status: 'pending',
    isTransferIntoOther: false,
    expiredAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  await ctx.reply(
    [
      `<b>💰订单创建成功💰</b>`,
      `\n`,
      `💱 兑换计算:\n${exchange.from_amount} USDT = ${exchange.to_amount} TRX`,
      `\n`,
      `机器人收款钱包: <code>${bot.auto_exchange_address}</code>`,
      `\n`,
      `请在 ${formatBeijingDate(exchange.expiredAt)} 之前(10分钟内)转账付款`,
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: replyKeyboard,
    },
  );

  return showExchangeConversation(conversation, ctx, {
    bot,
    botUser,
    realPrice,
    base_id,
  });
}

const handleShow = async (ctx: MyContext) => {
  const response = await axios.get(
    'https://openapi.sun.io/v2/allpairs?page_size=1&page_num=0&token_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t&orderBy=price',
  );

  debug(response.data);

  const result = response.data.data['0_TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'];
  const realPrice = result.price * (1 - ctx.currentBot.fee / 100);

  const initialMessage = [
    `📈实时汇率`,
    `1 USDT = ${realPrice} TRX`,
    '\n',
    '<b>自动兑换地址</b>',
    `<code>${ctx.currentBot.auto_exchange_address}</code>(点击地址自动复制)`,
    '\n',
    '🚫请不要使用交易所或中心化钱包转账❗️切记‼️',
    '🏪转账即兑,全自动返,等值1U起兑，全网最高汇率',
    'U→TRX 即转即兑',
    '\n',
    '输入钱包地址,可以查余额',
    '\n',
    '📌<b>请输入兑换数量,例如:"20U"</b>',
  ].join('\n');

  const inline_menu = new InlineKeyboard()
    .text('🔄 兑换给他人', 'exchange_to_others')
    .url('大额联系老板', ctx.currentBot.contact || 'https://t.me/aodi93');

  await ctx.reply(initialMessage, {
    parse_mode: 'HTML',
    reply_markup: inline_menu,
  });

  await ctx.conversation.enter('showExchangeConversation', {
    bot: ctx.currentBot,
    botUser: ctx.currentBotUser,
    realPrice,
    base_id: result.base_id,
  });
};

exchangeShowComposer.use(createConversation(showExchangeConversation));

exchangeShowComposer.hears(/^💱 TRX 兑换$/, async (ctx) => {
  await ctx.conversation.exitAll();
  await handleShow(ctx);
});

exchangeShowComposer.callbackQuery('exchange_show', async (ctx) => {
  await ctx.conversation.exitAll();
  await handleShow(ctx);
});

export default exchangeShowComposer;
