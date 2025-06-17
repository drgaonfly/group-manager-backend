import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { handleWalletListWithoutInlineMenu } from './handleWalletList';
import createDebug from 'debug';

const debug = createDebug('bot:wallet:show');

const walletShowComposer = new Composer<MyContext>();

export const handleShow = async (ctx: MyContext, page = 1) => {
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '➕ 添加地址', callback_data: 'wallet_add_address' },
        { text: '⚙️ 设置地址', callback_data: 'wallet_set_address' },
        { text: '🗑 删除地址', callback_data: 'wallet_delete_address' },
      ],
      [{ text: '❌ 取消', callback_data: 'close' }],
    ],
  };
  const { replyText } = await handleWalletListWithoutInlineMenu(page);

  await ctx.reply(replyText, {
    parse_mode: 'HTML',
    reply_markup: inlineKeyboard,
  });
};

walletShowComposer.hears(/^🏦 地址监听$/, async (ctx) => {
  debug('🏦 地址监听');

  await handleShow(ctx, 1);
});

export default walletShowComposer;
