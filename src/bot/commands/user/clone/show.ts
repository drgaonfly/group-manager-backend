import { Composer } from 'grammy';
import { MyContext } from '../../../types';

const cloneShowComposer = new Composer<MyContext>();

cloneShowComposer.hears(/^🆓 免费克隆/, async (ctx) => {
  const messages = [
    '🏠 你好！',
    '',
    '欢迎克隆 全网最全功能 的同款多功能机器人：记账，钱包监听，机器人TRX兑换，群发',
  ];

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '🚀 立即克隆', callback_data: 'clone_start' },
        { text: '❌ 取消', callback_data: 'clone_cancel' },
      ],
    ],
  };

  await ctx.reply(messages.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: inlineKeyboard,
  });
});

export default cloneShowComposer;
