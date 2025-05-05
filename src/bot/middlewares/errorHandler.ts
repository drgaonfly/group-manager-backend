// src/middlewares/errorHandler.ts
import { Middleware } from 'grammy';
import createDebug from 'debug';

const debug = createDebug('bot:error');

const errorHandler: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    debug('发生错误:', err);
    await ctx.reply('抱歉，发生了一些错误。');
  }
};

export default errorHandler;
