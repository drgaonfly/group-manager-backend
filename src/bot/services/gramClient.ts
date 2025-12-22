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
  });
}

/**
 * 获取 gramClient
 * 优先使用数据库中保存的 session 进行 connect，没有 session 才 start 并保存
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

  if (savedSession) {
    // 有 session，直接 connect
    await client.connect();
    debug(`[gramClient] 使用已有 session 连接成功`);
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
