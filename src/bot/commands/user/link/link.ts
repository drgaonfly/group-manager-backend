import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';

const linkCommand = new Composer<MyContext>();

const debug = createDebug('bot:link');

export async function handleLink(ctx: MyContext) {
  // 邀请功能已废弃
  await ctx.reply('此功能已废弃，请使用推广链接功能。', {
    parse_mode: 'HTML',
  });
}

// 邀请链接命令处理
linkCommand.command('link', async (ctx) => {
  debug('link');
  await handleLink(ctx);
});

export default linkCommand;
