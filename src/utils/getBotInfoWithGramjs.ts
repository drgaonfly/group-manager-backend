import { createTelegramClient } from '../bot/services/gramClient';

export const getBotInfoWithGramjs = async (token: string) => {
  const gramClient = createTelegramClient('');
  try {
    await gramClient.start({ botAuthToken: token });
    const botInfo = await gramClient.getMe();
    const session = gramClient.session.save() as unknown as string;
    await gramClient.disconnect();

    console.log('获取到的机器人信息:', botInfo);

    // 处理 id，可能是 BigInt 或对象
    let botId = '';
    if (botInfo.id) {
      if (typeof botInfo.id === 'object' && 'value' in botInfo.id) {
        botId = String((botInfo.id as any).value);
      } else {
        botId = String(botInfo.id);
      }
    }

    return {
      id: botId,
      username: botInfo.username || '',
      firstName: botInfo.firstName || '',
      lastName: botInfo.lastName || '',
      session,
    };
  } catch (error) {
    console.log('使用 gramjs 获取机器人信息失败:', error);
    await gramClient.disconnect().catch(() => {});
    throw error;
  }
};
