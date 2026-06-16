import crypto from 'crypto';
import User from '../models/user';

/**
 * 生成用于 User.inviteCode 的唯一邀请码
 */
export async function generateUserInviteCode(length = 8): Promise<string> {
  let code: string;
  do {
    code = crypto
      .randomBytes(length)
      .toString('base64')
      .replace(/[+/=]/g, '')
      .slice(0, length);
  } while (await User.findOne({ inviteCode: code }));
  return code;
}
