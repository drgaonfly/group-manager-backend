import { IBotUser } from '../models/botUser';

interface UserInfo {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

/**
 * 格式化用户名显示，处理 null/undefined 的情况
 */
function formatUsername(username: string | null | undefined): string {
  if (!username || username === 'null' || username === 'undefined') {
    return '(空)';
  }
  return username;
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
    const oldUsername = formatUsername(existingUser.userName);
    const newUsername = formatUsername(newInfo.username);
    changes.push(`用户名: @${oldUsername} → @${newUsername}`);
  }
  if (
    existingUser.firstName !== newInfo.first_name &&
    (existingUser.firstName || newInfo.first_name)
  ) {
    const oldFirstName = existingUser.firstName || '(空)';
    const newFirstName = newInfo.first_name || '(空)';
    changes.push(`名字: ${oldFirstName} → ${newFirstName}`);
  }
  if (
    existingUser.lastName !== newInfo.last_name &&
    (existingUser.lastName || newInfo.last_name)
  ) {
    const oldLastName = existingUser.lastName || '(空)';
    const newLastName = newInfo.last_name || '(空)';
    changes.push(`姓氏: ${oldLastName} → ${newLastName}`);
  }

  if (changes.length === 0) return null;

  return [`🔔 用户信息变更 (ID: ${newInfo.id})`, ...changes].join('\n');
}
