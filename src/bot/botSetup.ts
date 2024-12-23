import { Bot } from 'grammy';
import logger from './middlewares/logger';
import adminComposer from './commands/admin';
import userComposer from './commands/user';
import errorHandler from './middlewares/errorHandler';
import { commandsList } from './commandsList';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { Context } from 'grammy'; // 确保导入 Context

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

    console.log('Bot 正在使用 SOCKS 代理：', SOCKS_PROXY_URL);
  } else {
    // 未设置代理，正常初始化 Bot
    bot = new Bot<Context>(token);
    console.log('Bot 未使用代理。');
  }

  bot.use(errorHandler);
  bot.use(logger);
  bot.use(userComposer.middleware());
  bot.use(adminComposer.middleware());

  // bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

  // 回复任何消息 "Hi there!"。
  bot.on('message', (ctx) => ctx.reply('Hi there!'));

  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery?.data;
    await ctx.answerCallbackQuery(`您点击了按钮: ${data}`);
  });

  // bot.api
  //   .setMyCommands(commandsList)
  //   .then(() => {
  //     console.log('命令已设置成功');
  //   })
  //   .catch((error) => {
  //     console.error('设置命令时发生错误:', error);
  //   });

  return bot;
};
