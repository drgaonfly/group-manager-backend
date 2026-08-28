import { Request, Response, NextFunction } from 'express';
import { setupBot } from '../bot/botSetup';

export const handleBotWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const bot = setupBot(req.params.token);

    // bot.init() 内部有去重保护，已初始化时直接返回，不会重复调用 getMe。
    // 同一 token 的 bot 实例被 botCache 缓存，进程生命周期内只初始化一次。
    if (!bot.isInited()) {
      await bot.init();
    }

    // 立即回 200，然后异步处理 update（fire-and-forget）。
    // ack 200 immediately, process the body asynchronously —
    // Telegram 官方文档、Stripe 等所有主流 webhook 的标准模式。
    res.sendStatus(200);
    void bot.handleUpdate(req.body);
  } catch (err) {
    next(err);
  }
};
