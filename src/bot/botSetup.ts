import { Bot, GrammyError, HttpError, session } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import logger from './middlewares/logger';
import userComposer from './commands/user';
import errorHandler from './middlewares/errorHandler';
import botResolver from './middlewares/botResolver';
import botUserResolver from './middlewares/botUserResolver';
import groupResolver from './middlewares/groupResolver';
import replyRuleHandler from './middlewares/replyRuleHandler';
import { rankingPaginationHandler } from './middlewares/rankingPaginationHandler';
import { privateCommandsList, groupCommandsList } from './commandsList';
import { SocksProxyAgent } from 'socks-proxy-agent';
import botUserConfigResolver from './middlewares/botUserConfigResolver';
import proxyResolver from './middlewares/proxyResolver';
import { adRemovalResolver } from './middlewares/adRemovalResolver';
import { MyContext } from './types';
import { hydrateFiles } from '@grammyjs/files';
import { RedisAdapter } from '@grammyjs/storage-redis';
import { redis } from '../utils/redis';
import { conversations } from '@grammyjs/conversations';
import { autoQuote } from '@roziscoding/grammy-autoquote';
import createDebug from 'debug';

const log = createDebug('bot:setup');

// 全局 bot 实例缓存，同一 token 复用同一个 Bot 对象，避免高并发下重复初始化
const botCache = new Map<string, Bot<MyContext>>();

export const printWebhookInfo = async (bot: Bot) => {
  const info = await bot.api.getWebhookInfo();
  const debug = createDebug('bot:webhook');
  debug(`webhook info`);
  debug(info);
  return info;
};

export const setupBot = (token: string) => {
  // 缓存命中直接返回，避免高并发下重复初始化同一个 bot
  if (botCache.has(token)) {
    return botCache.get(token)!;
  }

  const storage = new RedisAdapter({
    instance: redis,
    ttl: 10,
    autoParseDates: true,
  });
  const SOCKS_PROXY_URL = process.env.SOCKS_PROXY_URL; // SOCKS 代理 URL，例如 'socks5://username:password@host:port'

  // 定义 bot 变量
  let bot: Bot<MyContext>;

  if (SOCKS_PROXY_URL) {
    // 创建 SOCKS 代理代理
    const socksAgent = new SocksProxyAgent(process.env.SOCKS_PROXY_URL);

    // 使用代理初始化 Bot
    bot = new Bot<MyContext>(token, {
      client: {
        baseFetchConfig: {
          agent: socksAgent,
          compress: true,
        },
      },
    });

    log('Bot 正在使用 SOCKS 代理：', SOCKS_PROXY_URL);
  } else {
    // 未设置代理，正常初始化 Bot
    bot = new Bot<MyContext>(token);
    log('Bot 未使用代理。');
  }

  // 使用 session 中间件
  bot.use(
    session({
      initial: () => ({}),
      storage,
    }),
  );

  bot.use(autoQuote());

  // 由于 session 已经合并到 context，后续中间件类型也要兼容 MyContext
  // 需要确保所有中间件都用 MyContext 类型
  bot.use(conversations());
  bot.use(botResolver);
  bot.use(botUserResolver);
  bot.use(botUserConfigResolver);
  bot.use(groupResolver);
  bot.use(proxyResolver);
  bot.use(errorHandler);

  // 处理广告的优先级高于一般消息处理
  bot.use(adRemovalResolver);

  bot.use(logger);
  bot.use(rankingPaginationHandler);
  bot.use(replyRuleHandler);
  bot.use(userComposer.middleware());
  // bot.use(adminComposer.middleware());

  // bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

  // 回复任何消息 "Hi there!"。
  // bot.on('message', (ctx) => ctx.reply('Hi there!'));

  bot.callbackQuery('close', async (ctx) => {
    log('用户点击了按钮: close');
    await ctx.conversation.exitAll();
    await ctx.deleteMessage();
    await ctx.answerCallbackQuery({ text: '消息已删除' });
  });

  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) {
      console.error('Error in request:', e.description);
    } else if (e instanceof HttpError) {
      console.error('Could not contact Telegram:', e);
    } else {
      console.error('Unknown error:', e);
    }
  });

  bot.api.config.use(autoRetry());
  bot.api.config.use(hydrateFiles(token));

  // 写入缓存，后续同 token 的请求直接复用
  botCache.set(token, bot);

  return bot;
};

/**
 * 从缓存中删除指定 token 的 bot 实例（bot 下线或 token 更换时调用）
 */
export const evictBotCache = (token: string) => {
  botCache.delete(token);
  log(`已清除 token 缓存: ${token.slice(0, 10)}...`);
};

/**
 * 仅在启动脚本中调用一次，设置所有 bot 的命令菜单。
 * 不要在 webhook 请求处理流程中调用此函数。
 */
export const setupBotCommands = async (bot: Bot<MyContext>) => {
  await bot.api.setMyCommands(privateCommandsList, {
    scope: { type: 'all_private_chats' },
  });
  log('私聊命令已设置成功');

  if (groupCommandsList.length > 0) {
    await bot.api.setMyCommands(groupCommandsList, {
      scope: { type: 'all_group_chats' },
    });
    log('群组命令已设置成功');
  }
};
