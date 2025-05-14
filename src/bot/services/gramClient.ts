import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import createDebug from 'debug';

const debug = createDebug('gram:bot');

const stringSession = ''; // leave this empty for now
// const BOT_TOKEN = process.env.BOT_TOKEN; // put your bot token here

// 从环境变量获取API凭证
const apiId = 1025907;
const apiHash = '452b0359b988148995f22ff0f4229750';

// 创建并返回一个新的 Telegram 客户端实例
export function createTelegramClient(stringSession) {
  return new TelegramClient(new StringSession(stringSession), apiId, apiHash, {
    connectionRetries: 5,
  });
}

export const client = createTelegramClient(stringSession);

export async function startClientAndGetSession(token: string) {
  await client.start({
    botAuthToken: token,
  });

  debug(client.session.save());

  return client.session.save();
}
