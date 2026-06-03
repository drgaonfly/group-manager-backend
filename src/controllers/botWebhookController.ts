import handleAsync from '../utils/handleAsync';
import { Request, Response } from 'express';
import { default as BotManager } from '../models/bot';
import { setupBot } from '../bot/botSetup';

export const handleBotWebhook = handleAsync(
  async (req: Request, res: Response) => {
    // Handle the webhook
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
      res.status(404);
      throw new Error('bot not found');
    }

    const bot = setupBot(botManager.token);

    const allowedUpdates = [
      'message',
      'edited_message',
      'channel_post',
      'edited_channel_post',
      'callback_query',
      'inline_query',
      'chosen_inline_result',
      'chat_member', // 群组成员变化（加入/离开）
      'my_chat_member', // bot 自己的成员状态变化
      'chat_join_request', // 加群请求
    ] as const;

    await bot.start({
      allowed_updates: allowedUpdates,
    });

    await bot.handleUpdate(req.body);
  },
);
