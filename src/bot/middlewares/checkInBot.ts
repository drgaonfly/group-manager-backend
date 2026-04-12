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

/** 供 /start 使用：允许私聊与群/超级群，便于在群内展示自由键盘（自定义 ReplyKeyboard） */
export const checkStartAllowedChats = async (
  ctx: MyContext,
  next: () => Promise<void>,
) => {
  debug('checkStartAllowedChats');
  const type = ctx.chat?.type;
  if (!ctx.chat) return;
  if (type === 'private' || type === 'group' || type === 'supergroup') {
    await next();
    return;
  }
  await ctx.reply('请在私聊或群组中使用 /start').catch(() => {});
};
