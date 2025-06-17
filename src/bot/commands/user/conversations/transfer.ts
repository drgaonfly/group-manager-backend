import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { IBotUserConfig } from '../../../../models/botUserConfig';

const exchangeTransferComposer = new Composer<MyContext>();
const debug = createDebug('bot:exchange:transfer');

const TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout

const cancelKeyboard = new InlineKeyboard().text('❌ 取消', 'close');

async function transferExchangeConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  {
    botUserConfig,
  }: {
    botUserConfig: IBotUserConfig;
  },
) {
  debug('Starting transfer exchange conversation');

  const trx_balance = botUserConfig.trx_balance;
  const usdt_balance = botUserConfig.usdt_balance;

  // Step 1: 获取接收地址
  const receiveMessage = [
    '请输入兑换的接收地址：',
    '',
    `当前TRX余额：${trx_balance}`,
    `当前USDT余额：${usdt_balance}`,
    '',
    '⏳ 此操作将在 5 分钟后过期',
  ].join('\n');

  await ctx.reply(receiveMessage, {
    parse_mode: 'HTML',
    reply_markup: cancelKeyboard,
  });

  const receiveResult = await conversation.waitFor(
    ['message:text', 'callback_query:data'],
    {
      maxMilliseconds: TIMEOUT,
    },
  );

  if (receiveResult.callbackQuery?.data === 'close') {
    debug('User cancelled transfer at receive address step');
    await ctx.reply('已取消转账');
    return;
  }

  const receiveAddress = receiveResult.message?.text;
  if (!receiveAddress || !/^T[a-zA-Z0-9]{33}$/.test(receiveAddress)) {
    await ctx.reply('❌ 请输入有效的波场地址格式');
    return;
  }

  // Step 2: 获取付款地址
  const payMessage = [
    '请输入付款地址：',
    '',
    `接收地址：${receiveAddress}`,
    '',
    '⏳ 此操作将在 5 分钟后过期',
  ].join('\n');

  await ctx.reply(payMessage, {
    parse_mode: 'HTML',
    reply_markup: cancelKeyboard,
  });

  const payResult = await conversation.waitFor(
    ['message:text', 'callback_query:data'],
    {
      maxMilliseconds: TIMEOUT,
    },
  );

  if (payResult.callbackQuery?.data === 'close') {
    debug('User cancelled transfer at pay address step');
    await ctx.reply('已取消转账');
    return;
  }

  const payAddress = payResult.message?.text;
  if (!payAddress || !/^T[a-zA-Z0-9]{33}$/.test(payAddress)) {
    await ctx.reply('❌ 请输入有效的波场地址格式');
    return;
  }

  // 直接使用变量，不需要存储在session中
  // Step 3: 确认信息
  const confirmMessage = [
    '请确认转账信息：',
    '',
    `接收地址：${receiveAddress}`,
    `付款地址：${payAddress}`,
    '',
    '请点击确认继续，或取消操作',
  ].join('\n');

  const confirmKeyboard = new InlineKeyboard()
    .text('✅ 确认', 'confirm_transfer')
    .row()
    .text('❌ 取消', 'close');

  await ctx.reply(confirmMessage, {
    parse_mode: 'HTML',
    reply_markup: confirmKeyboard,
  });

  const confirmResult = await conversation.waitFor(['callback_query:data'], {
    maxMilliseconds: TIMEOUT,
  });

  if (confirmResult.callbackQuery?.data === 'close') {
    debug('User cancelled transfer at confirmation step');
    await ctx.reply('已取消转账');
    return;
  }

  if (confirmResult.callbackQuery?.data === 'confirm_transfer') {
    // TODO: 这里添加实际的转账处理逻辑
    await ctx.reply(
      '✅ 转账请求已提交，处理中...\n' +
        `从: ${payAddress}\n` +
        `到: ${receiveAddress}`,
    );
  }
}

exchangeTransferComposer.use(createConversation(transferExchangeConversation));

exchangeTransferComposer.callbackQuery('exchange_to_others', async (ctx) => {
  debug('exchange_to_others callback triggered');

  await ctx.conversation.exitAll();

  await ctx.conversation.enter('transferExchangeConversation', {
    botUserConfig: ctx.currentBotUserConfig,
  });
});

export default exchangeTransferComposer;
