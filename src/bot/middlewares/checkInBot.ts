import { MyContext } from '../types';
import createDebug from 'debug';

const debug = createDebug('bot:checkInBot');

export const checkInBot = async (ctx: MyContext, next: () => Promise<void>) => {
  debug('checkInBot');
  debug(ctx.chat);
  if (!ctx.chat || ctx.chat.type !== 'private') {
    debug('请在机器人私聊中使用此命令');
    ctx.reply('Please use this command in a private chat with the bot');
    return;
  }

  await next();
};
