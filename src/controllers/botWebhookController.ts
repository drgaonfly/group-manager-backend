import handleAsync from '../utils/handleAsync';
import { Request, Response } from 'express';
import { default as BotManager } from '../models/bot';
import { setupBot } from '../bot/botSetup';

// Cache for bot instances to avoid recreating them
const botCache = new Map<string, ReturnType<typeof setupBot>>();

export const handleBotWebhook = handleAsync(
  async (req: Request, res: Response) => {
    // Handle the webhook
    console.log('Webhook received:', req.body);

    const botId = req.params.id;

    const botManager = await BotManager.findOne({ isOnline: true, _id: botId });

    if (!botManager) {
      res.status(404).json({ error: 'bot not found' });
      return;
    }

    // Get or create bot instance
    let bot = botCache.get(botId);
    if (!bot) {
      bot = setupBot(botManager.token);
      botCache.set(botId, bot);
      console.log(`Created new bot instance for bot ${botId}`);
    }

    // Handle the update directly without starting the bot
    try {
      await bot.handleUpdate(req.body);
      res.status(200).json({ status: 'ok' });
    } catch (error) {
      console.error('Error handling webhook update:', error);
      res.status(500).json({ error: 'Failed to process update' });
    }
  },
);
