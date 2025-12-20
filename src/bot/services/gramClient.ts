import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import createDebug from 'debug';

const debug = createDebug('gram:bot');

// 从环境变量获取API凭证
const apiId = 1025907;
const apiHash = '452b0359b988148995f22ff0f4229750';

// 持久化的 gramClient 连接池，key 为 bot token
const clientPool = new Map<string, TelegramClient>();

// 创建并返回一个新的 Telegram 客户端实例
export function createTelegramClient(stringSession: string = '') {
  return new TelegramClient(new StringSession(stringSession), apiId, apiHash, {
    connectionRetries: 5,
  });
}

/**
 * 获取或创建持久化的 gramClient
 * 如果已存在且已连接，直接返回；否则创建新连接
 */
export async function getOrCreateGramClient(
  botToken: string,
): Promise<TelegramClient> {
  const existing = clientPool.get(botToken);

  if (existing && existing.connected) {
    debug(`[gramClient] 复用已有连接: ${botToken.slice(0, 10)}...`);
    return existing;
  }

  // 如果存在但断开了，先清理
  if (existing) {
    try {
      await existing.disconnect();
    } catch (e) {
      // ignore
    }
    clientPool.delete(botToken);
  }

  debug(`[gramClient] 创建新连接: ${botToken.slice(0, 10)}...`);
  const client = createTelegramClient('');

  await client.start({
    botAuthToken: botToken,
  });

  clientPool.set(botToken, client);
  return client;
}

/**
 * 断开指定 bot 的连接
 */
export async function disconnectGramClient(botToken: string): Promise<void> {
  const client = clientPool.get(botToken);
  if (client) {
    try {
      await client.disconnect();
    } catch (e) {
      // ignore
    }
    clientPool.delete(botToken);
  }
}

/**
 * 断开所有连接（用于应用关闭时）
 */
export async function disconnectAllGramClients(): Promise<void> {
  for (const [token, client] of clientPool) {
    console.log('token', token);
    try {
      await client.disconnect();
    } catch (e) {
      // ignore
    }
  }
  clientPool.clear();
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
