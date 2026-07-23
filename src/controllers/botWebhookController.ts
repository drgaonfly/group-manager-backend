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

    // timeoutMilliseconds: 0 = 立即回复 200，异步处理 update。
    // 默认行为是等整个中间件链跑完才回 200，上粉高峰时会导致 Telegram
    // 推送积压（下一条要等上一条处理完），改为立即回复后 Telegram 可以
    // 全速推送，积压问题消失。
    return webhookCallback(bot, 'express', { timeoutMilliseconds: 0 })(
      req,
      res,
    );
  } catch (err) {
    next(err);
  }
};
