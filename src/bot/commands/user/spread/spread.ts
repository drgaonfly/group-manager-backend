import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { checkPermission } from '../../../middlewares/checkPermission';

import createDebug from 'debug';

const spreadCommand = new Composer<MyContext>();

const debug = createDebug('bot:spread');

export async function handleSpread(ctx: MyContext) {
  // 邀请功能已废弃
  await ctx.reply('此功能已废弃，请使用推广链接功能。', {
    parse_mode: 'HTML',
  });
}

// 推广命令处理
spreadCommand.hears(/Invite Link/, checkPermission, async (ctx) => {
  debug('spread');

  await handleSpread(ctx);
});

export default spreadCommand;
