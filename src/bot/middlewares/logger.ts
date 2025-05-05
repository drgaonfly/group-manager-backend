// src/middlewares/logger.ts
import { Middleware } from 'grammy';
import createDebug from 'debug';

const debug = createDebug('bot:logger');

// 定义一个日志中间件
const logger: Middleware = async (ctx, next) => {
  debug(
    `用户 ${ctx.from?.username || ctx.from?.id} 发来了消息: ${
      ctx.message?.text || '未知消息类型'
    }`,
  );
  await next();
};

export default logger;
