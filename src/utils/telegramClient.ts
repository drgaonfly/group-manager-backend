import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import dotenv from 'dotenv';

dotenv.config();

const API_ID = process.env.API_ID || '94575';
const API_HASH = process.env.API_HASH || 'a3406de8d171bb422bb6ddf3bbd800e2';
const PROXY_PORT = process.env.MONGODB_PROXYPORT || '7897';

// Create a new session
const session = new StringSession('');

// Configure proxy settings based on environment
const getClientConfig = () => {
  const config: any = {
    connectionRetries: 5,
  };

  if (process.env.MONGODB_PROXYPORT) {
    config.useWSS = false;
    config.proxy = {
      ip: "127.0.0.1",
      port: parseInt(PROXY_PORT),
      secret: "00000000000000000000000000000000",
      socksType: 5,
      timeout: 2,
    };
  }

  return config;
};

// Create and export the client instance
export const client = new TelegramClient(
  session,
  parseInt(API_ID),
  API_HASH,
  getClientConfig()
);

const telegramClient = async (): Promise<void> => {
  await client.connect();
  console.log('Telegram Client Connected');
};

export default telegramClient;
