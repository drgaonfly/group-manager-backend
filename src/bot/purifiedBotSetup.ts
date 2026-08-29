import { Bot } from 'grammy';
import { SocksProxyAgent } from 'socks-proxy-agent';
import createDebug from 'debug';

const log = createDebug('bot:cron-setup');

/**
 * cron 任务专用的 bot 实例缓存。
 *
 * 与 setupBot 完全独立：
 *   - 不挂载任何中间件（session、sequentialize、conversations 等）
 *   - 不使用 apiThrottler（避免 throttler 队列被一条慢请求阻塞整个 cron）
 *   - 不使用 autoRetry（cron 任务自己有错误处理，不需要无限重试）
 *   - 只设置 timeoutSeconds，确保网络挂起时能抛出异常
 *
 * 这样 cron 发消息时的每个 API 调用完全独立，一条失败不影响后续。
 */
const cronBotCache = new Map<string, Bot>();

export const getCronBot = (token: string): Bot => {
  if (cronBotCache.has(token)) {
    return cronBotCache.get(token)!;
  }

  const SOCKS_PROXY_URL = process.env.SOCKS_PROXY_URL;

  const bot = SOCKS_PROXY_URL
    ? new Bot(token, {
        client: {
          baseFetchConfig: {
            agent: new SocksProxyAgent(SOCKS_PROXY_URL),
            compress: true,
          },
          timeoutSeconds: 30,
        },
      })
    : new Bot(token, {
        client: {
          timeoutSeconds: 30,
        },
      });

  cronBotCache.set(token, bot);
  log(`cron bot 已创建: ${token.slice(0, 10)}...`);

  return bot;
};

export const evictCronBotCache = (token: string) => {
  cronBotCache.delete(token);
};
