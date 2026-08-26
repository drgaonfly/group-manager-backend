import { Bot, GrammyError, HttpError, session } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { apiThrottler } from '@grammyjs/transformer-throttler';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { MyContext } from './types';
import logger from './middlewares/logger';
import userComposer from './commands/user';
import errorHandler from './middlewares/errorHandler';
import botResolver from './middlewares/botResolver';
import botUserResolver from './middlewares/botUserResolver';
import botUserConfigResolver from './middlewares/botUserConfigResolver';
import { checkBotExpired } from './middlewares/checkBotExpired';
import { inlineMenuCallbackHandler } from './middlewares/inlineMenuCallbackHandler';
import { RedisAdapter } from '@grammyjs/storage-redis';
import { redis } from '../utils/redis';
import { hydrateFiles } from '@grammyjs/files';
import createDebug from 'debug';

const log = createDebug('bot:private-message-setup');

/**
 * 创建专用于私聊的 Bot 实例。
 *
 * 中间件链：session → botResolver → botUserResolver → botUserConfigResolver →
 *           checkBotExpired → errorHandler → logger → inlineMenuCallbackHandler → userComposer
 *
 * 跳过群组相关的中间件（groupResolver、adRemovalResolver、serviceMessageDeleter、
 * speechRewardHandler、rankingPaginationHandler、replyRuleHandler、managedBotHandler）
 *
 * 每次请求创建新实例，用完即弃，不缓存。
 * 目的：私聊消息与群聊消息完全隔离，群聊大量新用户加入时不会影响私聊响应速度。
 */
export const setupPrivateMessageBot = (token: string): Bot<MyContext> => {
  // 只在 Redis 连接正常时使用 RedisAdapter，否则用内存存储
  const storage = redis
    ? new RedisAdapter({
        instance: redis,
        ttl: 10,
        autoParseDates: true,
      })
    : undefined;

  if (!redis) {
    console.warn('⚠️ 私聊 Bot: Redis 未连接，使用内存存储');
  }

  const SOCKS_PROXY_URL = process.env.SOCKS_PROXY_URL;

  const bot = SOCKS_PROXY_URL
    ? new Bot<MyContext>(token, {
        client: {
          baseFetchConfig: {
            agent: new SocksProxyAgent(SOCKS_PROXY_URL),
            compress: true,
          },
        },
      })
    : new Bot<MyContext>(token);

  log('私聊 Bot 初始化');

  // 使用 session 中间件
  bot.use(
    session({
      initial: () => ({}),
      storage,
    }),
  );

  // 私聊需要的核心中间件
  bot.use(botResolver);
  bot.use(botUserResolver);
  bot.use(botUserConfigResolver);
  bot.use(errorHandler);
  bot.use(checkBotExpired);
  bot.use(logger);
  bot.use(inlineMenuCallbackHandler);
  bot.use(userComposer.middleware());

  bot.callbackQuery('close', async (ctx) => {
    log('私聊用户点击了按钮: close');
    await ctx.deleteMessage();
    await ctx.answerCallbackQuery({ text: '消息已删除' });
  });

  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(
      `私聊 Bot Error while handling update ${ctx.update.update_id}:`,
    );
    const e = err.error;
    if (e instanceof GrammyError) {
      console.error('Error in request:', e.description);
    } else if (e instanceof HttpError) {
      console.error('Could not contact Telegram:', e);
    } else {
      console.error('Unknown error:', e);
    }
  });

  // API 转换器
  bot.api.config.use(apiThrottler());
  bot.api.config.use(autoRetry());
  bot.api.config.use(hydrateFiles(token));

  return bot;
};
