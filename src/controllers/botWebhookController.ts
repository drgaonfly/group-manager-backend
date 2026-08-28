import { Request, Response, NextFunction } from 'express';
import { setupBot } from '../bot/botSetup';

export const handleBotWebhook = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 立即回 200，然后异步处理 update（fire-and-forget）。
    // 这是 Telegram 官方文档、Stripe 等所有主流 webhook 的标准模式：
    // ack 200 immediately, process the body asynchronously。
    //
    // grammY 的 webhookCallback 默认等中间件链跑完才回 200，
    // 上粉风暴时中间件链很慢，Telegram 迟迟收不到 200 就停止推送，
    // 导致所有群（包括正常群）的消息积压。
    //
    // handleUpdate 是 grammY 的底层方法，直接把 update 交给中间件链，
    // 不阻塞 HTTP 响应。错误由 bot.catch() 捕获，不会冒泡到 Express。
    res.sendStatus(200);
    void setupBot(req.params.token).handleUpdate(req.body);
  } catch (err) {
    next(err);
  }
};
