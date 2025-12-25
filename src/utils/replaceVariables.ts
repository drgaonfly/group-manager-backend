import { formatBeijingDate } from './formatBeijingDate';

export interface MemberInfo {
  id: number;
  username?: string;
  firstName: string;
  lastName?: string;
}

/**
 * 替换内容中的变量
 * 支持的变量：
 * - {member} - 带链接的成员名
 * - {userId} - 用户ID
 * - {nickname} - 用户昵称（firstName + lastName）
 * - {userName} - @username 或昵称
 * - {username} - 兼容旧格式，同 {userName}
 * - {memberName} - 兼容旧格式，同 {nickname}
 * - {groupTitle} - 群组名称
 * - {currentTime} - 北京时间
 */
export const replaceVariables = (
  content: string,
  member?: MemberInfo | null,
  groupTitle?: string,
): string => {
  if (!content) return content;

  const now = new Date();
  const beijingTime = formatBeijingDate(now);

  let result = content;

  // 替换时间和群组相关变量（始终可用）
  result = result
    .replace(/\{currentTime\}/g, beijingTime)
    .replace(/\{groupTitle\}/g, groupTitle || '');

  // 如果有成员信息，替换成员相关变量
  if (member) {
    // 构建带链接的成员名
    const memberLink = member.username
      ? `<a href="https://t.me/${member.username}">${member.firstName}</a>`
      : member.firstName;

    // 用户昵称
    const nickname = [member.firstName, member.lastName]
      .filter(Boolean)
      .join(' ');

    // 用户名（@username 或昵称）
    const userName = member.username ? `@${member.username}` : nickname;

    result = result
      .replace(/\{member\}/g, memberLink)
      .replace(/\{userId\}/g, String(member.id))
      .replace(/\{nickname\}/g, nickname)
      .replace(/\{userName\}/g, userName)
      .replace(/\{username\}/g, userName) // 兼容旧格式
      .replace(/\{memberName\}/g, nickname); // 兼容旧格式
  }

  return result;
};
