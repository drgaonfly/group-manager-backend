import { Bot } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { MyContext } from './types';
import botResolver from './middlewares/botResolver';
import proxyResolver from './middlewares/proxyResolver';
import groupResolver from './middlewares/groupResolver/index';

/**
 * 创建轻量 Bot 实例，专用于 chat_member / my_chat_member update。
 *
 * 中间件链：botResolver → proxyResolver → groupResolver
 * 跳过所有其他中间件（session、conversations、botUserResolver、
 * botUserConfigResolver、adRemovalResolver、speechRewardHandler 等）
 *
 * 每次请求创建新实例，用完即弃，不缓存。
 * 目的：上粉时与主 bot 完全隔离，不占用主 bot 事件循环。
 */
export const setupMemberEventBot = (token: string): Bot<MyContext> => {
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

  bot.use(botResolver);
  bot.use(proxyResolver);
  bot.use(groupResolver);

  bot.catch((err) => {
    console.error(`[memberBot] update ${err.ctx.update.update_id}:`, err.error);
  });

  bot.api.config.use(autoRetry());

  return bot;
};
