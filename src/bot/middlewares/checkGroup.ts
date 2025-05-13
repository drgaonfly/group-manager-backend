import { MyContext } from '../types';
import createDebug from 'debug';

const debug = createDebug('bot:checkGroup');

export const checkGroup = async (ctx: MyContext, next: () => Promise<void>) => {
  if (!ctx.currentGroup) {
    debug('不是群组');
    // ctx.reply('请在群组中使用此命令');
    return;
  } else {
    await next();
  }
};
