import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram';
import createDebug from 'debug';

const debug = createDebug('bot:info');

const apiId = 1025907;
const apiHash = '452b0359b988148995f22ff0f4229750';

export interface BotInfo {
  id: string;
  userName?: string;
  firstName?: string;
  lastName?: string;
  botName?: string;
}

/** 与 account-bot-backend 一致：gramjs + bot token 拉取机器人资料 */
export async function getBotInfoByToken(token: string): Promise<BotInfo> {
  const session = new StringSession('');
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    await client.start({
      botAuthToken: token,
    });

    debug('Connected to Telegram with bot token');

    const me = (await client.getEntity('me')) as Api.User;

    if (!me.id) {
      throw new Error('无法获取机器人 ID');
    }

    const botId = me.id.toString();

    await client.disconnect();

    return {
      id: botId,
      userName: me.username || undefined,
      firstName: me.firstName || undefined,
      lastName: me.lastName || undefined,
      botName: me.firstName || me.username || undefined,
    };
  } catch (error) {
    debug('Error getting bot info:', error);
    try {
      await client.disconnect();
    } catch (disconnectError) {
      debug('Error disconnecting client:', disconnectError);
    }
    throw error;
  }
}
