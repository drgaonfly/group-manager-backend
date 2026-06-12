import { Bot, GrammyError, HttpError, session } from 'grammy';
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
import channelPostSaver from './middlewares/channelPostSaver';

const log = createDebug('bot:setup');

export const printWebhookInfo = async (bot: Bot) => {
  const info = await bot.api.getWebhookInfo();
  const debug = createDebug('bot:webhook');
  debug(`webhook info`);
  debug(info);
  return info;
};

export const setupBot = (token: string) => {
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

  // 频道帖子保存，优先于其他中间件
  bot.use(channelPostSaver);

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

  // 带重试的 setMyCommands，遇到 429 时等待 retry_after 秒后重试
  const setCommandsWithRetry = async (
    commands: typeof privateCommandsList,
    scope: { type: string },
    label: string,
    maxRetries = 3,
  ) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await bot.api.setMyCommands(commands, { scope: scope as any });
        log(`${label}已设置成功`);
        return;
      } catch (error) {
        if (
          error instanceof GrammyError &&
          error.error_code === 429 &&
          attempt < maxRetries
        ) {
          const retryAfter = (error.parameters as any)?.retry_after ?? 30;
          log(
            `设置${label}时触发限流，${retryAfter}秒后重试 (${attempt}/${maxRetries})...`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, retryAfter * 1000),
          );
        } else {
          log(`设置${label}时发生错误:`, error);
          return;
        }
      }
    }
  };

  // 延迟执行命令设置，避免多实例同时启动时集中触发限流
  setTimeout(
    () => {
      setCommandsWithRetry(
        privateCommandsList,
        { type: 'all_private_chats' },
        '私聊命令',
      );

      if (groupCommandsList.length > 0) {
        // 私聊与群组命令设置错开 2 秒，进一步降低并发请求压力
        setTimeout(() => {
          setCommandsWithRetry(
            groupCommandsList,
            { type: 'all_group_chats' },
            '群组命令',
          );
        }, 2000);
      }
    },
    Math.floor(Math.random() * 3000),
  ); // 随机 0-3 秒初始延迟，分散多实例的请求

  bot.api.config.use(hydrateFiles(token));

  return bot;
};
