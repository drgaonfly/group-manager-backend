import { IBotUser } from '../models/botUser';

interface UserInfo {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

/**
 * 检测用户信息变更，返回变更消息（如果有）
 */
export function checkMemberNameUpdated(
  existingUser: IBotUser,
  newInfo: UserInfo,
): string | null {
  const changes: string[] = [];

  if (
    existingUser.userName !== newInfo.username &&
    (existingUser.userName || newInfo.username)
  ) {
    changes.push(`用户名: @${existingUser.userName} → @${newInfo.username}`);
  }
  if (
    existingUser.firstName !== newInfo.first_name &&
    (existingUser.firstName || newInfo.first_name)
  ) {
    changes.push(`名字: ${existingUser.firstName} → ${newInfo.first_name}`);
  }
  if (
    existingUser.lastName !== newInfo.last_name &&
    (existingUser.lastName || newInfo.last_name)
  ) {
    changes.push(`姓氏: ${existingUser.lastName} → ${newInfo.last_name}`);
  }

  if (changes.length === 0) return null;

  return [`🔔 用户信息变更 (ID: ${newInfo.id})`, ...changes].join('\n');
}
