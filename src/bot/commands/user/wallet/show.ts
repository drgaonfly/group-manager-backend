import { Composer } from 'grammy';
import { MyContext } from '../../../types';

const walletShowComposer = new Composer<MyContext>();

walletShowComposer.hears(/^🏦 地址监听$/, async (ctx) => {
  const messages = [
    '🏦 地址监听功能',
    '',
    '您可以在这里管理您的钱包监听地址：',
    '• 添加新的监听地址',
    '• 设置默认监听地址',
    '• 删除已添加的地址',
  ];

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

  await ctx.reply(messages.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: inlineKeyboard,
  });
});

export default walletShowComposer;
