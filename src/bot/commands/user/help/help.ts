import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import path from 'path';
import ejs from 'ejs';

// 发送帮助信息的函数
export async function sendHelpMessage(ctx: MyContext) {
  const templatePath = path.join(__dirname, '../../../../templates/help.ejs');
  const helpText = await ejs.renderFile(templatePath);

  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: '💰 开始记账',
          url: `https://t.me/${ctx.me.username}?startgroup=true`,
        },
      ],
    ],
  };

  await ctx.reply(helpText, {
    parse_mode: 'HTML',
    reply_markup: inlineKeyboard,
  });
}

const helpCommand = new Composer<MyContext>();

helpCommand.command('help', async (ctx) => {
  await sendHelpMessage(ctx);
});

export default helpCommand;
