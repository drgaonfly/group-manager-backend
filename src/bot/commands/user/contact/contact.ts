import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import { checkInBot } from '../../../../bot/middlewares/checkInBot';

const customerServiceCommand = new Composer<MyContext>();
const debug = createDebug('bot:contact');

// 监听"联系客服"文本消息
export async function handleContactCommand(ctx: MyContext) {
  debug('联系客服命令被触发');

  const bot = ctx.currentBot;

  // 直接回复客服链接
  await ctx.reply(bot.contact || '请设置客服内容', {
    parse_mode: 'HTML',
  });
}

customerServiceCommand.hears(/联系客服/, checkInBot, async (ctx) => {
  await handleContactCommand(ctx);
});

export default customerServiceCommand;
