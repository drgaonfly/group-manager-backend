import { webhookCallback } from 'grammy';
import dotenv from 'dotenv';
import createDebug from 'debug';
import express from 'express';
import { setupBot } from './botSetup';
import { default as BotManager } from '../models/bot';

dotenv.config();

const development = async () => {
  const activeBots = await BotManager.find({ isActive: true });

  for (const activeBot of activeBots) {
    const bot = setupBot(activeBot.token);
    const debug = createDebug('bot:dev');
    console.log('Bot 正在运行于开发模式');
    const botInfo = await bot.api.getMe();
    debug('Bot Info:', botInfo);

    debug('Bot runs in development mode');
    debug(`${botInfo.username} deleting webhook`);
    await bot.api.deleteWebhook();
    debug(`${botInfo.username} starting polling`);

    await bot.start();
  }
};

export const production = async (app?: express.Express) => {
  const activeBots = await BotManager.find({ isActive: true });

  for (const activeBot of activeBots) {
    const bot = setupBot(activeBot.token);
    const WEBHOOK_URL = process.env.WEBHOOK_URL;

    console.log('Bot 正在运行于生产模式');

    await bot.api.setWebhook(`${WEBHOOK_URL}/webhook-${activeBot._id}`);
    console.log(
      `Webhook ${activeBot.token} 已设置为 ${WEBHOOK_URL}/webhook-${activeBot.token}`,
    );

    app.use(`/webhook-${activeBot._id}`, webhookCallback(bot, 'express'));
  }
};

export const startBot = async (app?: express.Express) => {
  process.env.NODE_ENV === 'development' ? development() : production(app);
};
