import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import Wallet from '../../../../models/wallet';
import { createConversation, Conversation } from '@grammyjs/conversations';
import createDebug from 'debug';
import { handleShow } from '../wallet/show';

const walletClickComposer = new Composer<MyContext>();
const debug = createDebug('bot:wallet:click');

const TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout

const cancelKeyboard = new InlineKeyboard().text('❌ 取消', 'close');

async function walletEditRemarkConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  { walletId }: { walletId: string },
) {
  debug('Starting wallet remark edit conversation');

  // Ask for new remark
  await ctx.reply('请输入新的备注：\n\n⏳ 此操作将在 5 分钟后过期', {
    reply_markup: cancelKeyboard,
  });

  const conversationResult = await conversation.waitFor(
    ['message:text', 'callback_query:data'],
    {
      maxMilliseconds: TIMEOUT,
    },
  );

  if (conversationResult.callbackQuery?.data === 'close') {
    debug('User cancelled remark edit');
    await ctx.reply('已取消修改备注');
    return;
  }

  const { message } = conversationResult;
  const newRemark = message?.text;

  if (!newRemark) {
    await ctx.reply('❌ 请输入有效的备注');
    return;
  }

  const wallet = await Wallet.findById(walletId);
  if (!wallet) {
    await ctx.reply('❌ 地址不存在');
    return;
  }

  wallet.remark = newRemark;
  await wallet.save();

  await ctx.reply(`✅ 成功修改钱包${wallet.address}的备注为：${newRemark}`);

  await handleShow(ctx, 1);
}

walletClickComposer.use(createConversation(walletEditRemarkConversation));

walletClickComposer.callbackQuery(/set_([a-f0-9]{24})$/, async (ctx) => {
  const walletId = ctx.callbackQuery.data.split('_')[1];

  await ctx.conversation.exitAll();

  await ctx.conversation.enter('walletEditRemarkConversation', {
    walletId,
  });
});

export default walletClickComposer;
