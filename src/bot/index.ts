import dotenv from 'dotenv';
import { setupBot } from './botSetup';
import { default as BotManager } from '../../../../Telebot-Spam/spam-bot-backend/src/models/bot';

dotenv.config();

// 不再使用
export const startWebHookBot = async () => {
  const activeBots = await BotManager.find({ isOnline: true });

  for (const activeBot of activeBots) {
    const bot = await setupBot(activeBot.token);
    const WEBHOOK_URL = process.env.WEBHOOK_URL;

    console.log('Bot 正在运行于生产模式');

    console.log('删除 webhook');
    await bot.api.deleteWebhook();

    await bot.api.setWebhook(`${WEBHOOK_URL}/bot-webhooks/${activeBot._id}`);
    console.log(
      `${activeBot.userName} Webhook ${activeBot.token} 已设置为 ${WEBHOOK_URL}/webhook-${activeBot.token}`,
    );
  }
};
