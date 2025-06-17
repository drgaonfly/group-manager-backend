import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { IBotUserConfig } from '../../../../models/botUserConfig';

const exchangeTrxToUsdtComposer = new Composer<MyContext>();
const debug = createDebug('bot:exchange:trx_to_usdt');

const TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout

const returnKeyboard = new InlineKeyboard().text('返回', 'exchange_flash');

const cancelKeyboard = new InlineKeyboard().text('❌ 取消', 'close');

async function trxToUsdtExchangeConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  {
    botUserConfig,
  }: {
    botUserConfig: IBotUserConfig;
  },
) {
  debug('Starting TRX to USDT exchange conversation');

  const trx_balance = botUserConfig.trx_balance;

  const usdt_balance = botUserConfig.usdt_balance;

  const message = [
    '请输入要兑换的TRX金额：',
    '',
    `当前TRX余额：${trx_balance}`,
    `当前USDT余额：${usdt_balance}`,
    '',
    '⏳ 此操作将在 5 分钟后过期',
  ].join('\n');

  await ctx
    .editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: returnKeyboard,
    })
    .catch(() => {
      // 如果编辑失败（消息可能已被删除），则发送新消息
      return ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: returnKeyboard,
      });
    });

  let isValidInput = false;
  while (!isValidInput) {
    const conversationResult = await conversation.waitFor(
      ['message:text', 'callback_query:data'],
      {
        maxMilliseconds: TIMEOUT,
      },
    );

    if (conversationResult.callbackQuery?.data === 'exchange_flash') {
      debug('User cancelled exchange');
      await ctx.reply('已取消兑换');
      return;
    }

    const { message: userMessage } = conversationResult;
    const amount = parseFloat(userMessage?.text || '');

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('❌ 请输入有效的金额');
      continue;
    }

    if (amount > trx_balance) {
      await ctx.reply('余额不足', {
        parse_mode: 'HTML',
        reply_markup: cancelKeyboard,
      });
      continue;
    }

    // 输入有效且余额充足，显示确认信息
    const confirmMessage = [
      '请确认兑换信息：',
      '',
      `兑换金额：${amount} TRX`,
      `当前余额：${trx_balance} TRX`,
      '',
      '请点击确认继续，或返回重新输入',
    ].join('\n');

    const confirmKeyboard = new InlineKeyboard()
      .text('✅ 确认', 'confirm_exchange')
      .row()
      .text('返回重输', 'retry_input')
      .row()
      .text('取消', 'exchange_flash');

    await ctx.reply(confirmMessage, {
      parse_mode: 'HTML',
      reply_markup: confirmKeyboard,
    });

    const confirmResult = await conversation.waitFor(['callback_query:data'], {
      maxMilliseconds: TIMEOUT,
    });

    if (confirmResult.callbackQuery?.data === 'exchange_flash') {
      debug('User cancelled exchange at confirmation');
      await ctx.reply('已取消兑换');
      return;
    }

    if (confirmResult.callbackQuery?.data === 'retry_input') {
      debug('User chose to retry input');
      continue;
    }

    if (confirmResult.callbackQuery?.data === 'confirm_exchange') {
      // TODO: 这里添加实际的兑换逻辑
      await ctx.reply(`✅ 已收到兑换请求：${amount} TRX\n处理中...`);
      isValidInput = true;
    }
  }
}

exchangeTrxToUsdtComposer.use(
  createConversation(trxToUsdtExchangeConversation),
);

exchangeTrxToUsdtComposer.callbackQuery('trx_to_usdt', async (ctx) => {
  debug('trx_to_usdt callback triggered');
  await ctx.conversation.enter('trxToUsdtExchangeConversation', {
    botUserConfig: ctx.currentBotUserConfig,
  });
});

export default exchangeTrxToUsdtComposer;
