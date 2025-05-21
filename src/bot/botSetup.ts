import { Bot, GrammyError, HttpError } from 'grammy';
import logger from './middlewares/logger';
import userComposer from './commands/user';
import errorHandler from './middlewares/errorHandler';
import botResolver from './middlewares/botResolver';
import botUserResolver from './middlewares/botUserResolver';
import groupResolver from './middlewares/groupResolver';

import { commandsList } from './commandsList';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { Context } from 'grammy'; // 确保导入 Context
import createDebug from 'debug';

const log = createDebug('bot:setup');

export const printWebhookInfo = async (bot: Bot) => {
  const info = await bot.api.getWebhookInfo();
  const debug = createDebug('bot:webhook');
  debug(`webhook info`);
  debug(info);
  return info;
};

export const setupBot = (token: string) => {
  const SOCKS_PROXY_URL = process.env.SOCKS_PROXY_URL; // SOCKS 代理 URL，例如 'socks5://username:password@host:port'

  // 定义 bot 变量
  let bot: Bot;

  if (SOCKS_PROXY_URL) {
    // 创建 SOCKS 代理代理
    const socksAgent = new SocksProxyAgent(process.env.SOCKS_PROXY_URL);

    // 使用代理初始化 Bot
    bot = new Bot(token, {
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
    bot = new Bot<Context>(token);
    log('Bot 未使用代理。');
  }

  bot.use(botResolver);
  bot.use(botUserResolver);
  bot.use(groupResolver);
  bot.use(errorHandler);
  bot.use(logger);
  bot.use(userComposer.middleware());
  // bot.use(adminComposer.middleware());

  // bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

  // 回复任何消息 "Hi there!"。
  // bot.on('message', (ctx) => ctx.reply('Hi there!'));

  bot.on('callback_query:data', async (ctx) => {
    log('callback_query:data');
    const data = ctx.callbackQuery?.data;
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

  bot.api
    .setMyCommands(commandsList)
    .then(() => {
      console.log('命令已设置成功');
    })
    .catch((error) => {
      console.error('设置命令时发生错误:', error);
    });

  return bot;
};
