import { Request, Response, NextFunction } from 'express';
import { webhookCallback } from 'grammy';
import { default as BotManager } from '../models/bot';
import { setupBot } from '../bot/botSetup';
import { setupPrivateMessageBot } from '../bot/privateMessageBotSetup';

/**
 * 判断 update 是否来自私聊
 */
const isPrivateChat = (update: any): boolean => {
  // inline 查询通常来自私聊
  if (update.inline_query || update.chosen_inline_result) {
    return true;
  }
  // 检查所有包含 chat 字段的 update 类型
  const chat =
    update.message?.chat ||
    update.callback_query?.message?.chat ||
    update.edited_message?.chat;
  return chat?.type === 'private';
};

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

    const botManager = await BotManager.findOne({ isOnline: true, _id: botId });

    if (!botManager) {
      res.status(404).json({ error: 'bot not found' });
      return;
    }

    // 根据消息类型选择不同的 bot 实例
    // 私聊使用独立的 bot 实例，避免群聊高峰影响私聊响应
    const isPrivate = isPrivateChat(req.body);
    const bot = isPrivate
      ? setupPrivateMessageBot(botManager.token)
      : setupBot(botManager.token);

    console.log(
      `使用 ${isPrivate ? '私聊' : '群聊'} Bot 处理 update_id: ${req.body
        ?.update_id}`,
    );

    // timeoutMilliseconds: 0 = 立即回复 200，异步处理 update。
    // 默认行为是等整个中间件链跑完才回 200，上粉高峰时会导致 Telegram
    // 推送积压（下一条要等上一条处理完），改为立即回复后 Telegram 可以
    // 全速推送，积压问题消失。
    return webhookCallback(bot, 'express')(req, res);
  } catch (err) {
    next(err);
  }
};
