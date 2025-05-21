import { setupBot } from './botSetup';
import { default as BotManager } from '../models/bot';
import createDebug from 'debug';
import setupDB from '../utils/db';

const development = async () => {
  const activeBots = await BotManager.find({ token: process.env.BOT_TOKEN });

  for (const activeBot of activeBots) {
    const bot = setupBot(activeBot.token);
    const debug = createDebug('bot:dev');

    debug('Bot 正在运行于开发模式');
    const botInfo = await bot.api.getMe();
    debug('Bot Info:', botInfo);

    debug('Bot runs in development mode');
    debug(`${botInfo.username} deleting webhook`);
    await bot.api.deleteWebhook();
    debug(`${botInfo.username} starting polling`);

    await bot.start();
  }
};

setupDB();

development();
