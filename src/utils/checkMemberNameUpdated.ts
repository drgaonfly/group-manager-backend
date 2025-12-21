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
 * 获取昵称（firstName + lastName 的组合）
 */
function getNickname(
  firstName?: string | null,
  lastName?: string | null,
): string {
  const first = firstName || '';
  const last = lastName || '';
  const nickname = `${first} ${last}`.trim();
  return nickname || '(空)';
}

/**
 * 检测用户信息变更，返回变更消息（如果有）
 */
export function checkMemberNameUpdated(
  existingUser: IBotUser,
  newInfo: UserInfo,
): string | null {
  // 计算原昵称和新昵称
  const oldNickname = getNickname(
    existingUser.firstName,
    existingUser.lastName,
  );
  const newNickname = getNickname(newInfo.first_name, newInfo.last_name);

  // 检测昵称变化
  const nicknameChanged = oldNickname !== newNickname;

  // 检测用户名变化
  const oldUsername = formatUsername(existingUser.userName);
  const newUsername = formatUsername(newInfo.username);
  const usernameChanged = oldUsername !== newUsername;

  // 如果没有变化，返回 null
  if (!nicknameChanged && !usernameChanged) {
    return null;
  }

  // 构建变更项列表（用于标题）
  const changeItems: string[] = [];
  if (nicknameChanged) {
    changeItems.push('昵称');
  }
  if (usernameChanged) {
    changeItems.push('用户名');
  }
  const changeText = changeItems.join('和');

  // 构建消息内容
  const messageParts: string[] = [];
  messageParts.push(`系统检测到用户 ${newInfo.id} 修改了${changeText}`);
  messageParts.push(''); // 空行

  // 添加昵称变化信息
  if (nicknameChanged) {
    messageParts.push(`原昵称: ${oldNickname}`);
    messageParts.push(`新昵称: ${newNickname}`);
  }

  // 添加用户名变化信息
  if (usernameChanged) {
    messageParts.push(`原用户名: @${oldUsername}`);
    messageParts.push(`新用户名: @${newUsername}`);
  }

  messageParts.push('');
  messageParts.push('请注意规避风险⚠️');

  return messageParts.join('\n');
}
