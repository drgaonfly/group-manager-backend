import { Composer } from 'grammy';
import { MyContext } from '../../../types';

// 发送帮助信息的函数
export async function sendHelpMessage(ctx: MyContext) {
  const help = await ctx.currentBot.help;

  if (help) {
    await ctx.reply(help, {
      parse_mode: 'HTML',
    });
  } else {
    await ctx.reply('机器人未设置help');
  }
}

const helpCommand = new Composer<MyContext>();

helpCommand.command('help', async (ctx) => {
  await sendHelpMessage(ctx);
});

export default helpCommand;
