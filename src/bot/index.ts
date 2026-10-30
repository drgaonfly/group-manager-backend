import dotenv from 'dotenv';
import { setupBot, setupBotCommands } from './botSetup';
import { getCronBot } from './purifiedBotSetup';
import { default as BotManager } from '../models/bot';
import setupDB from '../utils/db';
import { setupRedis } from '../utils/redis';
import { GrammyError } from 'grammy';
dotenv.config();

export const startWebHookBot = async () => {
  await setupDB();
  await setupRedis();
  const activeBots = await BotManager.find({ isOnline: true });

  for (const activeBot of activeBots) {
    try {
      // deleteWebhook/setWebhook 用 cronBot（无 autoRetry/throttler），超时即抛，不会卡住脚本
      const cronBot = getCronBot(activeBot.token);
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
      await cronBot.api.deleteWebhook();
      await cronBot.api.setWebhook(
        `${WEBHOOK_URL}/bot-webhooks/${activeBot.token}`,
        {
          // @ts-ignore
          allowed_updates: allowedUpdates,
        },
      );

      // 命令菜单用完整实例设置（带 apiThrottler 避免限流）
      const fullBot = setupBot(activeBot.token);
      await setupBotCommands(fullBot);

      console.log(
        `${activeBot.userName} Webhook 已设置为 ${WEBHOOK_URL}/bot-webhooks/${activeBot.token}`,
      );
    } catch (err) {
      // 401 Unauthorized：token 失效，跳过，不影响其他 bot
      if (err instanceof GrammyError && err.error_code === 401) {
        console.warn(
          `设置 bot ${activeBot.userName} (${activeBot.token.slice(
            0,
            10,
          )}...) 时收到 401，token 可能已失效，跳过`,
        );
        continue;
      }

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
