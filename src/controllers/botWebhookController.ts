import handleAsync from '../utils/handleAsync';
import { Request, Response } from 'express';
import { default as BotManager } from '../models/bot';
import { setupBot } from '../bot/botSetup';

export const handleBotWebhook = handleAsync(
  async (req: Request, res: Response) => {
    // Handle the webhook
    console.log('Webhook received:', req.body);

    const botId = req.params.id;

    const botManager = await BotManager.findOne({ isActive: true, _id: botId });

    if (!botManager) {
      res.status(404);
      throw new Error('bot not found');
    }

    const bot = setupBot(botManager.token);

    await bot.start();

    await bot.handleUpdate(req.body);
  },
);
