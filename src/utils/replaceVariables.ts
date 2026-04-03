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
 * - {currentBot} - 当前机器人昵称
 */
export const replaceVariables = (
  content: string,
  member?: MemberInfo | null,
  groupTitle?: string,
  userBalance?: number,
  botName?: string,
  userBalanceRanking?: number,
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
    .replace(/\{groupTitle\}/g, groupTitle || '')
    .replace(/\{currentBot\}/g, botName || '');

  // 替换排名变量
  result = result.replace(
    /\{userBalanceRanking\}/g,
    userBalanceRanking !== undefined && userBalanceRanking !== null
      ? String(userBalanceRanking)
      : '',
  );

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
  lottery: any,
  options: {
    joinNum?: number;
    currentBot?: string;
    winnerList?: string;
    openTime?: string;
    nickname?: string;
    userId?: number;
    userName?: string;
    userBalanceRanking?: number;
  } = {},
): string => {
  if (!content) return content;

  let result = content;

  // 基础变量
  const now = new Date();
  const beijingTime = formatBeijingDate(now);

  // 奖品列表格式化
  const goodsList = lottery.prizes
    .map((p: any, i: number) => {
      const valueText = `${p.value}`;
      return `${i + 1}. ${p.name} - ${valueText} x${p.quantity}份`;
    })
    .join('\n');

  // 开奖条件格式化
  const openConditions: string[] = [];
  if (lottery.drawMethod.includes('fullParticipants')) {
    openConditions.push(`满${lottery.fullParticipantsCount}人开奖`);
  }
  if (
    lottery.drawMethod.includes('scheduledTime') &&
    lottery.scheduledDrawTime
  ) {
    openConditions.push(`${formatBeijingDate(lottery.scheduledDrawTime)}`);
  }

  result = result
    .replace(/\{lotteryTitle\}/g, lottery.title || '')
    .replace(/\{goodsList\}/g, goodsList)
    .replace(/\{joinCondition\}/g, '无') // 机器人本位架构下简化了
    .replace(/\{openCondition\}/g, openConditions.join(' 或 '))
    .replace(/\{joinNum\}/g, String(options.joinNum || 0))
    .replace(/\{currentTime\}/g, beijingTime)
    .replace(/\{currentBot\}/g, options.currentBot || '')
    .replace(/\{winnerList\}/g, options.winnerList || '')
    .replace(/\{openTime\}/g, options.openTime || '')
    .replace(/\{nickname\}/g, options.nickname || '')
    .replace(/\{userId\}/g, String(options.userId || ''))
    .replace(/\{userName\}/g, options.userName || '')
    .replace(
      /\{userBalanceRanking\}/g,
      options.userBalanceRanking !== undefined &&
        options.userBalanceRanking !== null
        ? String(options.userBalanceRanking)
        : '',
    );

  return result;
};
