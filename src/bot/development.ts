import { setupBot } from './botSetup';
import { default as BotManager } from '../models/bot';
import createDebug from 'debug';
import setupDB from '../utils/db';
import { setupRedis } from '../utils/redis';

const development = async () => {
  await setupDB();
  await setupRedis();
  const activeBots = await BotManager.find({ token: process.env.BOT_TOKEN });

  for (const activeBot of activeBots) {
    const bot = setupBot(activeBot.token);
    const debug = createDebug('bot:dev');

    debug('Bot 正在运行于开发模式');
    const botInfo = await bot.api.getMe();
    debug('Bot Info:', botInfo);

    debug('Bot runs in development mode');
    debug(`${botInfo.username} deleting webhook`);
    await bot.api.deleteWebhook();
    debug(`${botInfo.username} starting polling`);

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
  }
};

development();
