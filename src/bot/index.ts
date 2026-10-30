import dotenv from 'dotenv';
import { setupBot, setupBotCommands, evictBotCache } from './botSetup';
import { default as BotManager } from '../models/bot';
import { setupRedis } from '../utils/redis';
import { GrammyError } from 'grammy';
import setupDB from '../utils/db';
dotenv.config();

/**
 * 判断一个错误是否属于 401 Unauthorized（token 无效或已被吊销）
 */
const isUnauthorizedError = (err: unknown): boolean => {
  return err instanceof GrammyError && err.error_code === 401;
};

/**
 * 延迟指定毫秒数
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 用 getMe 探测 token 是否真的失效。
 * 返回 true 表示确认失效，返回 false 表示 token 仍然有效（可能是暂时性网络抖动）。
 */
const confirmTokenInvalid = async (token: string): Promise<boolean> => {
  const { Bot } = await import('grammy');
  const probe = new Bot(token);
  try {
    await probe.api.getMe();
    // getMe 成功 → token 有效，是暂时性错误，不下线
    return false;
  } catch (e) {
    if (isUnauthorizedError(e)) {
      // getMe 也返回 401 → token 确实失效
      return true;
    }
    // 其他错误（网络超时等）→ 保守处理，不下线
    return false;
  }
};

export const startWebHookBot = async () => {
  await setupDB();
  await setupRedis();
  const activeBots = await BotManager.find({ isOnline: true });

  for (const activeBot of activeBots) {
    const botLabel = `${activeBot.userName} (${activeBot.token.slice(
      0,
      10,
    )}...)`;

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
      // ── 401 Unauthorized 专项处理 ────────────────────────────────────────
      if (isUnauthorizedError(err)) {
        console.warn(`[bot:setup] ${botLabel} 收到 401，等待 2s 后重试一次...`);
        await delay(2000);

        try {
          // 重试一次完整的 webhook 初始化
          const bot = await setupBot(activeBot.token);
          const WEBHOOK_URL = process.env.WEBHOOK_URL;
          const allowedUpdates = [
            'message',
            'edited_message',
            'channel_post',
            'edited_channel_post',
            'callback_query',
            'inline_query',
            'chosen_inline_result',
            'my_chat_member',
            'chat_join_request',
            'managed_bot',
          ] as const;

          await bot.api.deleteWebhook();
          await bot.api.setWebhook(
            `${WEBHOOK_URL}/bot-webhooks/${activeBot.token}`,
            { allowed_updates: allowedUpdates as any },
          );
          await setupBotCommands(bot);

          console.log(`[bot:setup] ${botLabel} 重试成功，Webhook 已设置`);
          continue;
        } catch (retryErr) {
          if (isUnauthorizedError(retryErr)) {
            // 重试仍然 401 → 用 getMe 做最终确认，避免网络抖动误伤
            console.warn(
              `[bot:setup] ${botLabel} 重试仍然 401，正在用 getMe 确认 token 有效性...`,
            );
            const invalid = await confirmTokenInvalid(activeBot.token);

            if (invalid) {
              // 确认 token 失效 → 下线并从缓存中清除
              evictBotCache(activeBot.token);
              await BotManager.updateOne(
                { _id: activeBot._id },
                { $set: { isOnline: false } },
              );
              console.error(
                `[bot:setup] ${botLabel} token 已确认失效，已标记为 isOnline: false`,
              );
            } else {
              // getMe 成功 → token 有效，可能是暂时性故障，保留在线状态
              console.warn(
                `[bot:setup] ${botLabel} getMe 探测成功，token 仍有效，跳过本次初始化（保持在线）`,
              );
            }
          } else {
            // 重试时遇到非 401 错误，正常记录，不下线
            console.error(
              `[bot:setup] ${botLabel} 重试时出错（非 401）:`,
              retryErr,
            );
          }
          continue;
        }
      }

      // ── 其他错误：记录日志，继续处理下一个 bot ──────────────────────────
      console.error(`设置 bot ${botLabel} webhook 时出错:`, err);
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
