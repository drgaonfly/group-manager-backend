import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import axios from 'axios';
import createBug from 'debug';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { IBot } from '../../../../models/bot';

const exchangeShowComposer = new Composer<MyContext>();

const debug = createBug('bot:exchange');

const TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout

async function showExchangeConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  {
    bot,
  }: {
    bot: IBot;
  },
) {
  const response = await axios.get(
    'https://openapi.sun.io/v2/allpairs?page_size=1&page_num=0&token_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t&orderBy=price',
  );

  debug(response.data);

  const result = response.data.data['0_TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'];
  const realPrice = result.price * (1 - bot.fee / 100);

  const initialMessage = [
    `📈实时汇率`,
    `1 USDT = ${realPrice} TRX`,
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
    '📌<b>请输入兑换数量,例如:"20U"</b>',
  ].join('\n');

  const inline_menu = new InlineKeyboard()
    .text('🔄 兑换给他人', 'exchange_to_others')
    .url('大额联系老板', bot.contact || 'https://t.me/aodi93');

  await ctx.reply(initialMessage, {
    parse_mode: 'HTML',
    reply_markup: inline_menu,
  });

  const isActive = true;

  while (isActive) {
    const textResult = await conversation.waitFor('message:text', {
      maxMilliseconds: TIMEOUT,
    });

    const text = textResult.message?.text;
    if (!text) continue;

    const replyKeyboard = new InlineKeyboard()
      .text('❌ 关闭', 'close')
      .url('联系客服', bot.contact || 'https://t.me/aodi93');

    // Check if the input matches the pattern XU (where X is a number)
    const match = text.match(/^(\d+(?:\.\d+)?)U$/i);
    if (!match) {
      await ctx.reply('❌ 请输入正确的格式，例如: "20U"', {
        parse_mode: 'HTML',
        reply_markup: replyKeyboard,
      });
      continue;
    }

    const usdtAmount = parseFloat(match[1]);
    const trxAmount = usdtAmount * realPrice;

    await ctx.reply(
      [
        `📈实时汇率`,
        `1 USDT = ${realPrice} TRX`,
        '\n',
        `💱 兑换计算:\n${usdtAmount} USDT ≈ ${trxAmount.toFixed(2)} TRX`,
        '<b>自动兑换地址</b>',
        `<code>${result.base_id}</code>(点击地址自动复制)`,
        '\n',
        '<b>注意: 请认准TK2u开头, JBxYa结尾</b>',
      ].join('\n'),
      {
        parse_mode: 'HTML',
        reply_markup: replyKeyboard,
      },
    );
  }
}

const handleShow = async (ctx: MyContext) => {
  await ctx.conversation.enter('showExchangeConversation', {
    bot: ctx.currentBot,
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
