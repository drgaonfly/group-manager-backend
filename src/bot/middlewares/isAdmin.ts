// src/middlewares/permission.ts
import { Middleware } from 'grammy';

const adminIds: number[] = [];

const isAdmin: Middleware = async (ctx, next) => {
  if (ctx.from && adminIds.includes(ctx.from.id)) {
    await next();
  } else {
    await ctx.reply('您没有权限执行此操作。');
  }
};

export default isAdmin;
