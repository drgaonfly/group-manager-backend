import { Composer } from 'grammy';
import { MyContext } from '../../types';
import { mainMenu } from '../../menus/mainMenu';

const startCommand = new Composer<MyContext>();

startCommand.command('start', async (ctx) => {
  await ctx.reply('欢迎使用我的机器人！请选择一个选项：', {
    reply_markup: mainMenu,
  });
});

export default startCommand;
