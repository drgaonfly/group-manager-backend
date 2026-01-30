/**
 * Telegram 消息变量替换工具
 */

export interface MessageVariables {
  username?: string; // 用户名（@格式）
  memberName?: string; // 用户真实姓名
  userId?: string; // 用户ID
  groupTitle?: string; // 群组标题
  currentTime?: string; // 当前时间
}

/**
 * 替换消息中的变量占位符
 * 支持多种格式（不区分大小写）：
 * - {username} / {userName}
 * - {memberName} / {member} / {nickname}
 * - {userId}
 * - {groupTitle}
 * - {currentTime}
 */
export function replaceMessageVariables(
  text: string,
  variables: MessageVariables,
): string {
  if (!text) return text;

  let result = text;

  // 替换用户名
  if (variables.username) {
    result = result
      .replace(/\{username\}/gi, variables.username)
      .replace(/\{userName\}/gi, variables.username);
  }

  // 替换成员名称
  if (variables.memberName) {
    result = result
      .replace(/\{memberName\}/gi, variables.memberName)
      .replace(/\{member\}/gi, variables.memberName)
      .replace(/\{nickname\}/gi, variables.memberName);
  }

  // 替换用户ID
  if (variables.userId) {
    result = result.replace(/\{userId\}/gi, variables.userId);
  }

  // 替换群组标题
  if (variables.groupTitle) {
    result = result.replace(/\{groupTitle\}/gi, variables.groupTitle);
  }

  // 替换当前时间
  if (variables.currentTime) {
    result = result.replace(/\{currentTime\}/gi, variables.currentTime);
  }

  return result;
}
