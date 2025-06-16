import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import Wallet from '../../../../models/wallet';
import { IBotUser } from '../../../../models/botUser';
import { IBot } from '../../../../models/bot';
import createDebug from 'debug';

const walletAddComposer = new Composer<MyContext>();
const debug = createDebug('bot:wallet:add');

const TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout

const cancelKeyboard = new InlineKeyboard().text('❌ 取消', 'close');

// Define conversation handler
async function walletAddAddressConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  { botUser, bot }: { botUser: IBotUser; bot: IBot },
) {
  debug('Starting wallet address conversation');
  const conversationResult = await conversation.waitFor(
    ['message:text', 'callback_query:data'],
    {
      maxMilliseconds: TIMEOUT,
    },
  );

  const { message } = conversationResult;

  if (conversationResult.callbackQuery?.data === 'close') {
    debug('User cancelled wallet address input');
    await ctx.reply('已取消添加监控地址');
    return;
  }

  // Basic Ethereum address validation
  if (!/^T[a-zA-Z0-9]{33}$/.test(message?.text || '')) {
    debug('Invalid address format received:', message?.text);
    await ctx.reply('❌ 请输入有效的Tron地址格式\n', {
      reply_markup: cancelKeyboard,
    });
    return await walletAddAddressConversation(conversation, ctx, {
      botUser,
      bot,
    });
  }

  const address = message.text;
  debug('Valid address received:', address);

  // 判断是否已经存在
  const existingWallet = await Wallet.findOne({
    address,
    botUser,
    bot,
  });

  if (existingWallet) {
    await ctx.reply('❌ 该地址已存在');
    return await walletAddAddressConversation(conversation, ctx, {
      botUser,
      bot,
    });
  }

  await Wallet.create({
    address,
    botUser,
    bot,
  });

  await ctx.reply(`✅ 成功添加监控地址：${address}`);
}

walletAddComposer.use(createConversation(walletAddAddressConversation));

walletAddComposer.callbackQuery('wallet_add_address', async (ctx) => {
  debug('Wallet add address callback triggered');

  const messages = [
    '请输入要绑定的监控地址',
    '\n',
    '⚠️ 请确保输入正确的Tron地址格式',
    '\n',
    '例如: <code>TSggLtscigXrfqWqNVuvMjTWdQwrQACK1h</code>',
    '\n',
    '⏳ 此操作将在 5 分钟后过期',
  ].join('\n');

  const inlineKeyboard = new InlineKeyboard().text('❌ 取消', 'close');

  await ctx.reply(messages, {
    parse_mode: 'HTML',
    reply_markup: inlineKeyboard,
  });

  await ctx.conversation.enter('walletAddAddressConversation', {
    botUser: ctx.currentBotUser,
    bot: ctx.currentBot,
  });
});

export default walletAddComposer;
