import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';

const orderCommand = new Composer<MyContext>();
const debug = createDebug('bot:order');

// 监听"order"命令
export async function handleOrderCommand(ctx: MyContext) {
  debug('order 命令被触发');

  // 直接回复小程序链接
  await ctx.reply('https://t.me/win_777Peryabot/program', {
    parse_mode: 'HTML',
  });
}

// 支持 /order 命令和“order”文本
orderCommand.command('order', async (ctx) => {
  await handleOrderCommand(ctx);
});

export default orderCommand;
