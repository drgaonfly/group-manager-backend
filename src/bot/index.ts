import { Bot } from 'grammy';
import dotenv from 'dotenv';
import { SocksProxyAgent } from 'socks-proxy-agent';
import createDebug from 'debug';
import logger from './middlewares/logger';
import adminComposer from './commands/admin';
import userComposer from './commands/user';
import errorHandler from './middlewares/errorHandler';
import { commandsList } from './commandsList';
import setupDB from '../utils/db';

dotenv.config();

// 从环境变量中获取 BOT_TOKEN 和 SOCKS_PROXY_URL
const BOT_TOKEN = process.env.BOT_TOKEN; // 你的机器人令牌
const SOCKS_PROXY_URL = process.env.SOCKS_PROXY_URL; // SOCKS 代理 URL，例如 'socks5://username:password@host:port'

// 检查 BOT_TOKEN 是否存在
if (!BOT_TOKEN) {
  console.error('错误：未在环境变量中设置 BOT_TOKEN。');
  process.exit(1);
}

// 定义 bot 变量
let bot: Bot;

if (SOCKS_PROXY_URL) {
  // 创建 SOCKS 代理代理
  const socksAgent = new SocksProxyAgent(process.env.SOCKS_PROXY_URL);

  // 使用代理初始化 Bot
  bot = new Bot(BOT_TOKEN, {
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
  bot = new Bot(BOT_TOKEN);
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

bot.api
  .setMyCommands(commandsList)
  .then(() => {
    console.log('命令已设置成功');
  })
  .catch((error) => {
    console.error('设置命令时发生错误:', error);
  });

const debug = createDebug('bot:dev');

const development = async (bot: Bot) => {
  const botInfo = await bot.api.getMe();
  debug('Bot Info:', botInfo);

  debug('Bot runs in development mode');
  debug(`${botInfo.username} deleting webhook`);
  await bot.api.deleteWebhook();
  debug(`${botInfo.username} starting polling`);

  await bot.start();
};

setupDB();

development(bot);
