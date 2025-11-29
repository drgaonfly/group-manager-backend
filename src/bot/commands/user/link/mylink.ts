import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { checkInBot } from '../../../middlewares/checkInBot';

import createDebug from 'debug';

const myLinkCommand = new Composer<MyContext>();

const debug = createDebug('bot:myLink');

export async function handleMyLink(ctx: MyContext) {
  // 邀请功能已废弃
  await ctx.reply('此功能已废弃，请使用推广链接功能。', {
    parse_mode: 'HTML',
  });
}

// myLink 命令处理
myLinkCommand.command('my_link', checkInBot, async (ctx) => {
  debug('myLink');

  await handleMyLink(ctx);
});

export default myLinkCommand;
