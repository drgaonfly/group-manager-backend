import { Composer, InlineKeyboard } from 'grammy';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { MyContext } from '../../../types';
import { checkSuccess } from '../../../middlewares/checkSuccess';
import { handleInheritCode } from '../success/successHandler';
import createDebug from 'debug';

const debug = createDebug('bot:conversation:inherit');

const inheritComposer = new Composer<MyContext>();

const TIMEOUT = 3 * 60 * 1000; // 3 分钟超时
const cancelKeyboard = new InlineKeyboard().text('❌ 取消', 'close');

/**
 * 立即继承对话流程：等待用户输入继承码
 */
async function inheritConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  {
    bot,
    botUser,
  }: {
    bot: any;
    botUser: any;
  },
) {
  await ctx.reply('💸 *立即继承*\n\n请输入继承码（8位大写字母/数字）：', {
    parse_mode: 'Markdown',
    reply_markup: cancelKeyboard,
  });

  const result = await conversation.waitFor(
    ['message:text', 'callback_query:data'],
    { maxMilliseconds: TIMEOUT },
  );

  if (result.callbackQuery?.data === 'close') {
    await ctx.reply('❌ 已取消操作');
    return;
  }

  const code = result.message?.text?.trim();
  if (!code) {
    await ctx.reply('❌ 输入无效，请重试');
    return;
  }

  await handleInheritCode(ctx, bot, botUser, code);
}

inheritComposer.use(createConversation(inheritConversation));

// /inherit 命令触发对话（由 /start inherit 的按钮点击后发送）
inheritComposer.callbackQuery('inherit', checkSuccess, async (ctx) => {
  debug('立即继承命令触发');
  await ctx.conversation.exitAll();
  await ctx.conversation.enter('inheritConversation', {
    bot: ctx.currentBot,
    botUser: ctx.currentBotUser,
  });
});

export default inheritComposer;
