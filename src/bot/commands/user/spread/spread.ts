import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { checkPermission } from '../../../middlewares/checkPermission';

import createDebug from 'debug';

const spreadCommand = new Composer<MyContext>();

const debug = createDebug('bot:spread');

export async function handleSpread(ctx: MyContext) {
  const userName = ctx.currentBot.userName;
  const spread_code = ctx.currentBotUserConfig.spread_code;

  const message = [
    `<b>您的推广链接是：</b>`,
    `https://t.me/${userName}?start=${spread_code}`,
  ].join('\n');

  await ctx.reply(message, {
    parse_mode: 'HTML',
  });
}

// 推广命令处理
spreadCommand.hears(/推广链接/, checkPermission, async (ctx) => {
  debug('spread');

  await handleSpread(ctx);
});

export default spreadCommand;
