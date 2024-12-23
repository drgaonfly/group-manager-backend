import { webhookCallback } from 'grammy';
import dotenv from 'dotenv';
import express from 'express';
import { setupBot } from './botSetup';
import { default as BotManager } from '../models/bot';

dotenv.config();

// 不再使用
export const production = async (app?: express.Express) => {
  const activeBots = await BotManager.find({ isActive: true });

  for (const activeBot of activeBots) {
    const bot = setupBot(activeBot.token);
    const WEBHOOK_URL = process.env.WEBHOOK_URL;

    console.log('Bot 正在运行于生产模式');

    await bot.api.setWebhook(`${WEBHOOK_URL}/webhook-${activeBot._id}`);
    console.log(
      `${activeBot.userName} Webhook ${activeBot.token} 已设置为 ${WEBHOOK_URL}/webhook-${activeBot.token}`,
    );

    app.use(`/webhook-${activeBot._id}`, webhookCallback(bot, 'express'));
  }
};

export const startWebHookBot = async (app?: express.Express) => {
  production(app);
};
