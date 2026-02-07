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
 * - {userName} - 优先昵称，没有再用 @username
 * - {username} - 兼容旧格式，同 {userName}
 * - {memberName} - 兼容旧格式，同 {nickname}
 * - {userBalance} - 用户积分余额
 * - {groupTitle} - 群组名称
 * - {currentTime} - 北京时间
 */
export const replaceVariables = (
  content: string,
  member?: MemberInfo | null,
  groupTitle?: string,
  userBalance?: number,
): string => {
  if (!content) return content;

  const now = new Date();
  const beijingTime = formatBeijingDate(now);

  let result = content;

  // 处理 HTML 实体
  result = result.replace(/&nbsp;/g, ' ');

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

    // 显示名：优先昵称，没有再用 @username
    const userName = nickname || (member.username ? `@${member.username}` : '');

    result = result
      .replace(/\{member\}/g, memberLink)
      .replace(/\{userId\}/g, String(member.id))
      .replace(/\{nickname\}/g, nickname)
      .replace(/\{userName\}/g, userName)
      .replace(/\{username\}/g, userName) // 兼容旧格式
      .replace(/\{memberName\}/g, nickname) // 兼容旧格式
      .replace(
        /\{userBalance\}/g,
        userBalance !== undefined && userBalance !== null
          ? String(userBalance)
          : '',
      );
  }

  return result;
};

/**
 * 替换抽奖内容中的变量
 * 支持的变量：
 * - {lotteryTitle} - 抽奖标题
 * - {goodsList} - 奖品内容
 * - {joinCondition} - 参与条件
 * - {openCondition} - 开奖条件
 * - {joinNum} - 已参与人数
 * - {winnerList} - 中奖名单（仅开奖通知）
 * - {openTime} - 开奖时间（仅开奖通知）
 */
export const replaceLotteryVariables = (
  content: string,
  lottery: {
    title: string;
    prizes: Array<{ name: string; value: number; quantity: number }>;
    drawMethod: string[];
    fullParticipantsCount?: number;
    scheduledDrawTime?: Date;
  },
  additionalData?: {
    joinNum?: number;
    winnerList?: string;
    openTime?: string;
  },
): string => {
  if (!content) return content;

  let result = content;

  // 基础变量替换
  result = result.replace(/\{lotteryTitle\}/g, lottery.title);

  // 构建奖品列表
  const goodsList = lottery.prizes
    .map((p) => `${p.name} x${p.quantity} (${p.value}积分)`)
    .join('\n');
  result = result.replace(/\{goodsList\}/g, goodsList);

  // 构建参与条件
  const joinCondition = '加入机器人关联群组';
  result = result.replace(/\{joinCondition\}/g, joinCondition);

  // 构建开奖条件
  const conditions: string[] = [];
  if (
    lottery.drawMethod.includes('fullParticipants') &&
    lottery.fullParticipantsCount
  ) {
    conditions.push(`满${lottery.fullParticipantsCount}人开奖`);
  }
  if (
    lottery.drawMethod.includes('scheduledTime') &&
    lottery.scheduledDrawTime
  ) {
    const timeStr = formatBeijingDate(lottery.scheduledDrawTime);
    conditions.push(`定时开奖 (${timeStr})`);
  }
  const openCondition = conditions.join(' 或 ');
  result = result.replace(/\{openCondition\}/g, openCondition);

  // 额外数据（开奖相关）
  if (additionalData) {
    if (additionalData.joinNum !== undefined) {
      result = result.replace(/\{joinNum\}/g, String(additionalData.joinNum));
    }
    if (additionalData.winnerList !== undefined) {
      result = result.replace(/\{winnerList\}/g, additionalData.winnerList);
    }
    if (additionalData.openTime !== undefined) {
      result = result.replace(/\{openTime\}/g, additionalData.openTime);
    }
  }

  return result;
};
