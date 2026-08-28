import { Request, Response, NextFunction } from 'express';
import { webhookCallback } from 'grammy';
import { default as BotManager } from '../models/bot';
import { setupBot } from '../bot/botSetup';

export const handleBotWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const botId = req.params.id;

    const botManager = await BotManager.findOne({ isOnline: true, _id: botId });

    if (!botManager) {
      res.status(404).json({ error: 'bot not found' });
      return;
    }

    const bot = setupBot(botManager.token);

    // timeoutMilliseconds: 0 = 立即回 200，不等中间件链执行完。
    // 这是成熟 bot 框架（python-telegram-bot block=False、PTB concurrent_updates）
    // 的标准做法：解耦"收到消息"和"处理消息"，Telegram 可以持续推送，
    // 不会因为某个群的处理慢（如上粉风暴）而阻塞其他群的消息投递。
    return webhookCallback(bot, 'express', { timeoutMilliseconds: 0 })(
      req,
      res,
    );
  } catch (err) {
    next(err);
  }
};
