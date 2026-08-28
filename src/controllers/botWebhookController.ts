import { Request, Response, NextFunction } from 'express';
import { webhookCallback } from 'grammy';
import { setupBot } from '../bot/botSetup';

export const handleBotWebhook = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.params.token;
    const bot = setupBot(token);

    // timeoutMilliseconds: 0 = 立即回 200，不等中间件链执行完。
    // 解耦"收到消息"和"处理消息"：Telegram 收到 200 后立刻推下一条，
    // 群 A 的中间件链再慢，也不会让 Telegram 停止给群 B 投递消息。
    return webhookCallback(bot, 'express', { timeoutMilliseconds: 0 })(
      req,
      res,
    );
  } catch (err) {
    next(err);
  }
};
