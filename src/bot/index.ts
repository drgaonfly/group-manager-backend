import dotenv from 'dotenv';
import { setupBot, setupBotCommands } from './botSetup';
import { default as BotManager } from '../models/bot';
import setupDB from '../utils/db';
import { setupRedis } from '../utils/redis';
dotenv.config();

export const startWebHookBot = async () => {
  await setupDB();
  await setupRedis();
  const activeBots = await BotManager.find({ isOnline: true });

  for (const activeBot of activeBots) {
    try {
      const bot = await setupBot(activeBot.token);
      const WEBHOOK_URL = process.env.WEBHOOK_URL;

      console.log('Bot 正在运行于生产模式');

      const allowedUpdates = [
        'message',
        'edited_message',
        'channel_post',
        'edited_channel_post',
        'callback_query',
        'inline_query',
        'chosen_inline_result',
        'my_chat_member', // bot 自己的成员状态变化
        'chat_join_request', // 加群请求
        'managed_bot', // managed bot 创建/更新
      ] as const;

      // 强制重新设置 webhook，确保 allowed_updates 变更立即生效
      await bot.api.deleteWebhook();
      await bot.api.setWebhook(
        `${WEBHOOK_URL}/bot-webhooks/${activeBot.token}`,
        {
          // @ts-ignore
          allowed_updates: allowedUpdates,
        },
      );

      // 命令菜单只在启动时设置一次，每个 bot 串行执行避免并发限流
      await setupBotCommands(bot);

      console.log(
        `${activeBot.userName} Webhook 已设置为 ${WEBHOOK_URL}/bot-webhooks/${activeBot.token}`,
      );
    } catch (err) {
      console.error(
        `设置 bot ${activeBot.userName} (${activeBot.token}) webhook 时出错:`,
        err,
      );
      continue;
    }
  }
};

startWebHookBot()
  .then(() => {
    // 执行完成后退出进程
    process.exit(0);
  })
  .catch((error) => {
    // 发生错误时打印错误并以错误状态码退出
    console.error('启动 Webhook Bot 时发生错误:', error);
    process.exit(1);
  });
