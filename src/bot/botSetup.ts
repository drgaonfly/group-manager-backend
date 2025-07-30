import { Bot, GrammyError, HttpError, session } from 'grammy';
import logger from './middlewares/logger';
import userComposer from './commands/user';
import errorHandler from './middlewares/errorHandler';
import botResolver from './middlewares/botResolver';
import botUserResolver from './middlewares/botUserResolver';
import groupResolver from './middlewares/groupResolver';
import { privateCommandsList, groupCommandsList } from './commandsList';
import { SocksProxyAgent } from 'socks-proxy-agent';
import createDebug from 'debug';
import botUserConfigResolver from './middlewares/botUserConfigResolver';
import { MyContext } from './types'; // 引入你的 MyContext 类型
import { hydrateFiles } from '@grammyjs/files';
import { RedisAdapter } from '@grammyjs/storage-redis';
import { redis } from '../utils/redis';
import { conversations } from '@grammyjs/conversations';

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

  // 由于 session 已经合并到 context，后续中间件类型也要兼容 MyContext
  // 需要确保所有中间件都用 MyContext 类型
  bot.use(conversations());
  bot.use(botResolver);
  bot.use(botUserResolver);
  bot.use(botUserConfigResolver);
  bot.use(groupResolver);
  bot.use(errorHandler);
  bot.use(logger);
  bot.use(userComposer.middleware());
  // bot.use(adminComposer.middleware());

  // bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

  // 回复任何消息 "Hi there!"。
  // bot.on('message', (ctx) => ctx.reply('Hi there!'));

  bot.callbackQuery('close', async (ctx) => {
    log('用户点击了按钮: close');
    await ctx.conversation.exitAll();
    // 删除原消息
    await ctx.deleteMessage();
    // 可选：发送反馈提示（客户端显示短暂提示）
    await ctx.answerCallbackQuery({ text: '消息已删除' });
  });

  bot.on('callback_query:data', async (ctx) => {
    log('callback_query:data');
    const data = ctx.callbackQuery?.data;
    log(`用户点击了按钮: ${data}`);
    await ctx.answerCallbackQuery(`您点击了按钮: ${data}`);
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

  // 设置私聊命令
  bot.api
    .setMyCommands(privateCommandsList, {
      scope: { type: 'all_private_chats' },
    })
    .then(() => {
      log('私聊命令已设置成功');
    })
    .catch((error) => {
      log('设置私聊命令时发生错误:', error);
    });

  // 设置群组命令
  bot.api
    .setMyCommands(groupCommandsList, { scope: { type: 'all_group_chats' } })
    .then(() => {
      log('群组命令已设置成功');
    })
    .catch((error) => {
      log('设置群组命令时发生错误:', error);
    });

  bot.api.config.use(hydrateFiles(token));

  return bot;
};
