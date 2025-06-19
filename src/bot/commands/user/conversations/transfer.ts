import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { IBotUserConfig } from '../../../../models/botUserConfig';
import { IBot } from '../../../../models/bot';
import { IBotUser } from '../../../../models/botUser';
import Exchange from '../../../../models/exchange';
import { IdGen } from '../../../../utils/idGen';
import { formatBeijingDate } from '../../../../utils/formatBeijingDate';
import axios from 'axios';
import createDebug from 'debug';

const exchangeTransferComposer = new Composer<MyContext>();
const debug = createDebug('bot:exchange:transfer');

const TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout
const cancelKeyboard = new InlineKeyboard().text('❌ 取消', 'close');

interface TransferState {
  receiveAddress?: string;
  payAddress?: string;
  usdtAmount?: number;
  realPrice: number;
}

// Step 1: 收款地址
async function getReceiveAddressConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  state: TransferState,
) {
  const receiveResult = await conversation.waitFor(
    ['message:text', 'callback_query:data'],
    {
      maxMilliseconds: TIMEOUT,
    },
  );

  if (receiveResult.callbackQuery?.data === 'close') {
    await ctx.deleteMessage();
    await ctx.reply('❌ 已取消操作');
    return;
  }

  const receiveAddress = receiveResult.message?.text;
  if (!receiveAddress || !/^T[a-zA-Z0-9]{33}$/.test(receiveAddress)) {
    await ctx.reply('❌ 请输入有效的波场地址格式');
    return getReceiveAddressConversation(conversation, ctx, state);
  }

  state.receiveAddress = receiveAddress;
}

// // Step 2: 付款地址
// async function getPayAddressConversation(
//   conversation: Conversation<MyContext>,
//   ctx: MyContext,
//   state: TransferState,
// ) {
//   const payResult = await conversation.waitFor(
//     ['message:text', 'callback_query:data'],
//     {
//       maxMilliseconds: TIMEOUT,
//     },
//   );

//   if (payResult.callbackQuery?.data === 'close') {
//     await ctx.deleteMessage();
//     await ctx.reply('❌ 已取消操作');
//     return;
//   }

//   const payAddress = payResult.message?.text;
//   if (!payAddress || !/^T[a-zA-Z0-9]{33}$/.test(payAddress)) {
//     await ctx.reply('❌ 请输入有效的波场地址格式');
//     return getPayAddressConversation(conversation, ctx, state);
//   }

//   state.payAddress = payAddress;
// }

// Step 3: 兑换金额
async function getExchangeAmountConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  state: TransferState,
) {
  const amountResult = await conversation.waitFor(
    ['message:text', 'callback_query:data'],
    {
      maxMilliseconds: TIMEOUT,
    },
  );

  if (amountResult.callbackQuery?.data === 'close') {
    await ctx.deleteMessage();
    await ctx.reply('❌ 已取消操作');
    return;
  }

  const amountText = amountResult.message?.text;
  if (!amountText || !/^\d+(\.\d+)?$/.test(amountText)) {
    await ctx.reply('❌ 请只输入数字，例如: 20');
    return getExchangeAmountConversation(conversation, ctx, state);
  }

  state.usdtAmount = parseFloat(amountText);
}

// Step 4: 确认并创建订单
async function confirmAndCreateOrderConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  state: TransferState,
  bot: IBot,
  botUser: IBotUser,
) {
  const confirmResult = await conversation.waitFor(['callback_query:data'], {
    maxMilliseconds: TIMEOUT,
  });

  if (confirmResult.callbackQuery?.data === 'close') {
    await ctx.deleteMessage();
    await ctx.reply('❌ 已取消操作');
    return;
  }

  if (confirmResult.callbackQuery?.data === 'confirm_transfer') {
    const exchange = await Exchange.create({
      id: await IdGen.next(Exchange, 'id', 6),
      bot,
      botUser,
      from_address: bot.auto_exchange_address,
      to_address: state.receiveAddress!,
      from_amount: state.usdtAmount!,
      to_amount: state.usdtAmount! * state.realPrice,
      rate: state.realPrice,
      fee: bot.fee,
      status: 'pending',
      isTransferIntoOther: true,
      expiredAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    await ctx.reply(
      [
        `<b>💰订单创建成功💰</b>`,
        `\n`,
        `机器人付款钱包: <code>${bot.auto_exchange_address}</code>`,
        `\n`,
        `收款钱包: <code>${state.receiveAddress}</code>`,
        `\n`,
        `请在 ${formatBeijingDate(exchange.expiredAt)} 之前(10分钟内)转账付款`,
      ].join('\n'),
      {
        parse_mode: 'HTML',
      },
    );
  } else {
    return confirmAndCreateOrderConversation(
      conversation,
      ctx,
      state,
      bot,
      botUser,
    );
  }
}

// Main transfer conversation
async function transferExchangeConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  {
    realPrice,
    bot,
    botUser,
  }: {
    botUserConfig: IBotUserConfig;
    realPrice: number;
    bot: IBot;
    botUser: IBotUser;
  },
) {
  debug('Starting transfer exchange conversation');

  const state: TransferState = {
    realPrice,
    payAddress: bot.auto_exchange_address,
  };
  // const { trx_balance, usdt_balance } = botUserConfig;

  // Step 1: Send receive address message
  const receiveMessage = [
    '请输入兑换的接收地址：',
    '',
    '⏳ 此操作将在 5 分钟后过期',
  ].join('\n');
  await ctx.reply(receiveMessage, {
    parse_mode: 'HTML',
    reply_markup: cancelKeyboard,
  });

  await getReceiveAddressConversation(conversation, ctx, state);
  if (!state.receiveAddress) return;

  // Step 2: Send pay address message
  // const payMessage = [
  //   '请输入付款地址：',
  //   '',
  //   `接收地址：<code>${state.receiveAddress}</code>`,
  //   '',
  //   '⏳ 此操作将在 5 分钟后过期',
  // ].join('\n');
  // await ctx.reply(payMessage, {
  //   parse_mode: 'HTML',
  //   reply_markup: cancelKeyboard,
  // });

  // await getPayAddressConversation(conversation, ctx, state);
  // if (!state.payAddress) return;

  // Step 3: Send amount message
  const amountMessage = [
    '请输入兑换金额，只需输入数字，例如: 20',
    '',
    `接收地址：<code>${state.receiveAddress}</code>`,
    `付款地址：<code>${state.payAddress}</code>`,
    '',
    '⏳ 此操作将在 5 分钟后过期',
  ].join('\n');
  await ctx.reply(amountMessage, {
    parse_mode: 'HTML',
    reply_markup: cancelKeyboard,
  });

  await getExchangeAmountConversation(conversation, ctx, state);
  if (!state.usdtAmount) return;

  // Step 4: Send confirm message
  const confirmMessage = [
    '请确认兑换信息：',
    '\n',
    `接收地址：<code>${state.receiveAddress}</code>`,
    `付款地址：<code>${bot.auto_exchange_address}</code>`,
    `支付币种：${state.usdtAmount} USDT`,
    `接收币种：${state.usdtAmount! * state.realPrice} TRX`,
    '\n',
    '请点击确认继续，或取消操作',
  ].join('\n');

  const confirmKeyboard = new InlineKeyboard()
    .text('✅ 确认生成订单', 'confirm_transfer')
    .text('❌ 取消', 'close')
    .row();

  await ctx.reply(confirmMessage, {
    parse_mode: 'HTML',
    reply_markup: confirmKeyboard,
  });

  await confirmAndCreateOrderConversation(
    conversation,
    ctx,
    state,
    bot,
    botUser,
  );
}

exchangeTransferComposer.use(createConversation(transferExchangeConversation));

exchangeTransferComposer.callbackQuery('exchange_to_others', async (ctx) => {
  debug('exchange_to_others callback triggered');

  await ctx.conversation.exitAll();

  if (!ctx.currentBot.fee) {
    await ctx.reply('机器人没有设置手续费，请在后台设置');
    return;
  }

  const response = await axios.get(
    'https://openapi.sun.io/v2/allpairs?page_size=1&page_num=0&token_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t&orderBy=price',
  );

  const result = response.data.data['0_TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'];
  const realPrice = result.price * (1 - ctx.currentBot.fee / 100);

  await ctx.conversation.enter('transferExchangeConversation', {
    bot: ctx.currentBot,
    botUser: ctx.currentBotUser,
    realPrice,
  });
});

export default exchangeTransferComposer;
