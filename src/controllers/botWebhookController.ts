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
    console.log(
      'Webhook received update_id:',
      req.body?.update_id,
      'type:',
      Object.keys(req.body || {})
        .filter((k) => k !== 'update_id')
        .join(','),
    );

    const botId = req.params.id;

    // setupBot 内部已有 botCache（按 token 缓存），首次初始化后复用同一实例
    const botManager = await BotManager.findOne({ isOnline: true, _id: botId });

    if (!botManager) {
      res.status(404).json({ error: 'bot not found' });
      return;
    }

    const bot = setupBot(botManager.token);

    // webhookCallback 是 grammY 官方推荐的 webhook 处理方式，
    // 会自动调用 handleUpdate 并回复 200，无需手动调用
    return webhookCallback(bot, 'express')(req, res);
  } catch (err) {
    next(err);
  }
};
