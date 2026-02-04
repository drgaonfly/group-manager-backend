/**
 * Telegram 消息变量替换工具
 */

export interface MessageVariables {
  username?: string; // 用户名（@格式）
  memberName?: string; // 用户真实姓名
  userId?: string; // 用户ID
  userBalance?: string; // 用户积分余额
  groupTitle?: string; // 群组标题
  currentTime?: string; // 当前时间
}

/**
 * 替换消息中的变量占位符
 * 支持多种格式（不区分大小写）：
 * - {username} / {userName}
 * - {memberName} / {member} / {nickname}
 * - {userId}
 * - {userBalance}
 * - {groupTitle}
 * - {currentTime}
 */
export function replaceMessageVariables(
  text: string,
  variables: MessageVariables,
): string {
  if (!text) return text;

  let result = text;

  // 显示名：优先昵称（memberName），没有再用用户名（username）
  const displayName =
    (variables.memberName && variables.memberName.trim()) ||
    variables.username ||
    '';

  // 替换用户名/昵称（{userName}、{username} 均优先显示昵称）
  result = result
    .replace(/\{userName\}/gi, displayName)
    .replace(/\{username\}/gi, displayName);

  // 替换成员名称（与上面一致，保证 {memberName}/{member}/{nickname} 为昵称）
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

  // 替换用户余额（支持 0，仅未传入时不替换）
  if (variables.userBalance !== undefined && variables.userBalance !== null) {
    result = result.replace(/\{userBalance\}/gi, String(variables.userBalance));
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
