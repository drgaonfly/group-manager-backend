import dotenv from 'dotenv';
import { setupBot } from './botSetup';
import { default as BotManager } from '../models/bot';

dotenv.config();

// 不再使用
export const startWebHookBot = async () => {
  const activeBots = await BotManager.find({ isOnline: true });

  for (const activeBot of activeBots) {
    const bot = await setupBot(activeBot.token);
    const WEBHOOK_URL = process.env.WEBHOOK_URL;

    console.log('Bot 正在运行于生产模式');

    // 检查是否已设置 webhook
    const webhookInfo = await bot.api.getWebhookInfo();
    if (!webhookInfo.url) {
      console.log('未设置 webhook，执行删除操作');
      await bot.api.deleteWebhook();
      await bot.api.setWebhook(`${WEBHOOK_URL}/bot-webhooks/${activeBot._id}`);
    } else {
      console.log('webhook 已存在，跳过删除操作');
    }

    console.log(
      `${activeBot.userName} Webhook ${activeBot.token} 已设置为 ${WEBHOOK_URL}/webhook-${activeBot.token}`,
    );
  }
};
