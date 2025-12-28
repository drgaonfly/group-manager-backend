import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import createDebug from 'debug';
import Bot from '../../models/bot';

const debug = createDebug('gram:bot');

// 从环境变量获取API凭证
const apiId = 1025907;
const apiHash = '452b0359b988148995f22ff0f4229750';

// 创建并返回一个新的 Telegram 客户端实例
export function createTelegramClient(stringSession: string = '') {
  return new TelegramClient(new StringSession(stringSession), apiId, apiHash, {
    connectionRetries: 5,
    timeout: 30, // 设置连接超时时间（秒）
    requestRetries: 3, // 请求重试次数
  });
}

/**
 * 获取 gramClient
 * 优先使用数据库中保存的 session 进行 connect，没有 session 才 start 并保存
 * 注意：此客户端用于一次性查询，不监听实时更新
 */
export async function getGramClient(botToken: string): Promise<TelegramClient> {
  // 从数据库获取 bot 的 session
  const bot = await Bot.findOne({ token: botToken });
  const savedSession = bot?.session || '';

  debug(
    `[gramClient] 创建连接: ${botToken.slice(0, 10)}... session: ${
      savedSession ? '有' : '无'
    }`,
  );
  const client = createTelegramClient(savedSession);

  // 禁用更新循环，避免 TIMEOUT 错误
  // 这个客户端只用于查询，不需要监听实时更新
  client.setParseMode('html');

  if (savedSession) {
    // 有 session，直接 connect
    try {
      await client.connect();
      debug(`[gramClient] 使用已有 session 连接成功`);
    } catch (err: any) {
      debug(
        `[gramClient] 使用已有 session 连接失败: ${err.message}，尝试重新认证`,
      );
      // session 可能过期，重新 start
      await client.start({
        botAuthToken: botToken,
      });
      const newSession = client.session.save() as unknown as string;
      await Bot.updateOne(
        { token: botToken },
        { $set: { session: newSession } },
      );
      debug(`[gramClient] 重新认证成功，session 已更新`);
    }
  } else {
    // 没有 session，需要 start 并保存
    await client.start({
      botAuthToken: botToken,
    });
    const newSession = client.session.save() as unknown as string;
    await Bot.updateOne({ token: botToken }, { $set: { session: newSession } });
    debug(`[gramClient] 首次连接，session 已保存`);
  }

  return client;
}

// 兼容旧代码
const defaultStringSession = '';
export const client = createTelegramClient(defaultStringSession);

export async function startClientAndGetSession(token: string) {
  await client.start({
    botAuthToken: token,
  });

  debug(client.session.save());

  return client.session.save();
}
