//user
import crypto from 'crypto';
import BotUserConfig from '../models/botUserConfig';

export async function generateInviteCode(length: number = 5): Promise<string> {
  let inviteCode;
  do {
    inviteCode = crypto
      .randomBytes(length)
      .toString('base64')
      .replace(/[+/=]/g, '') // 移除特殊字符
      .slice(0, length); // 确保长度正确
  } while (await BotUserConfig.findOne({ spread_code: inviteCode }));
  return inviteCode;
}
