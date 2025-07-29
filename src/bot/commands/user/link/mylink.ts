import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { checkGroup } from '../../../middlewares/checkGroup';

import createDebug from 'debug';

const myLinkCommand = new Composer<MyContext>();

const debug = createDebug('bot:myLink');

export async function handleMyLink(ctx: MyContext) {
  const userName = ctx.currentBot.userName;
  const spread_code = ctx.currentBotUserConfig.spread_code;

  const message = [
    `<b>Your invitation link is:</b>`,
    `https://t.me/${userName}?start=${spread_code}_${ctx.currentGroup.id}`,
  ].join('\n');

  await ctx.reply(message, {
    parse_mode: 'HTML',
  });
}

// myLink 命令处理
myLinkCommand.command('my_link', checkGroup, async (ctx) => {
  debug('myLink');
  await ctx.reply('请在群组中使用此命令');
});

export default myLinkCommand;
