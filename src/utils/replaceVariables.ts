import { formatBeijingDate } from './formatBeijingDate';
import { escapeHtml } from './escapeHtml';

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
  userBalanceRankingList?: string,
): string => {
  if (!content) return content;

  const now = new Date();
  const beijingTime = formatBeijingDate(now);

  let result = content;

  // 处理 HTML 实体
  result = result.replace(/&nbsp;/g, ' ');

  // 替换时间和群组相关变量（始终可用）
  result = result
    .replace(/\{currentTime\}/g, escapeHtml(beijingTime))
    .replace(/\{groupTitle\}/g, escapeHtml(groupTitle || ''))
    .replace(/\{currentBot\}/g, escapeHtml(botName || ''));

  // 替换排名变量
  result = result.replace(
    /\{userBalanceRanking\}/g,
    userBalanceRanking !== undefined && userBalanceRanking !== null
      ? escapeHtml(String(userBalanceRanking))
      : '',
  );

  // 替换榜单变量
  result = result.replace(
    /\{userBalanceRankingList\}/g,
    userBalanceRankingList || '',
  );

  // 如果有成员信息，替换成员相关变量
  if (member) {
    // 构建带链接的成员名
    const memberLink = member.username
      ? `<a href="https://t.me/${member.username}">${escapeHtml(
          member.firstName,
        )}</a>`
      : escapeHtml(member.firstName);

    // 用户昵称
    const nickname = [member.firstName, member.lastName]
      .filter(Boolean)
      .join(' ');

    // 显示名：优先昵称，没有再用 @username
    const userName = nickname || (member.username ? `@${member.username}` : '');

    result = result
      .replace(/\{member\}/g, memberLink)
      .replace(/\{userId\}/g, escapeHtml(String(member.id)))
      .replace(/\{nickname\}/g, escapeHtml(nickname))
      .replace(/\{userName\}/g, escapeHtml(userName))
      .replace(/\{username\}/g, escapeHtml(userName)) // 兼容旧格式
      .replace(/\{memberName\}/g, escapeHtml(nickname)) // 兼容旧格式
      .replace(
        /\{userBalance\}/g,
        userBalance !== undefined && userBalance !== null
          ? escapeHtml(String(userBalance))
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
    userBalanceRankingList?: string;
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
    .replace(/\{lotteryTitle\}/g, escapeHtml(lottery.title || ''))
    .replace(/\{goodsList\}/g, escapeHtml(goodsList))
    .replace(/\{joinCondition\}/g, escapeHtml('无')) // 机器人本位架构下简化了
    .replace(/\{openCondition\}/g, escapeHtml(openConditions.join(' 或 ')))
    .replace(/\{joinNum\}/g, escapeHtml(String(options.joinNum || 0)))
    .replace(/\{currentTime\}/g, escapeHtml(beijingTime))
    .replace(/\{currentBot\}/g, escapeHtml(options.currentBot || ''))
    .replace(/\{winnerList\}/g, escapeHtml(options.winnerList || ''))
    .replace(/\{openTime\}/g, escapeHtml(options.openTime || ''))
    .replace(/\{nickname\}/g, escapeHtml(options.nickname || ''))
    .replace(/\{userId\}/g, escapeHtml(String(options.userId || '')))
    .replace(/\{userName\}/g, escapeHtml(options.userName || ''))
    .replace(
      /\{userBalanceRanking\}/g,
      options.userBalanceRanking !== undefined &&
        options.userBalanceRanking !== null
        ? escapeHtml(String(options.userBalanceRanking))
        : '',
    )
    .replace(
      /\{userBalanceRankingList\}/g,
      options.userBalanceRankingList || '',
    );

  return result;
};

/**
 * 替换竞拍内容中的变量
 * 支持的变量：
 * - {auctionTitle} - 竞拍标题
 * - {startingPrice} - 起拍价
 * - {bidIncrement} - 加价幅度
 * - {endTime} - 结束时间
 * - {currentHighestBid} - 当前最高出价
 * - {bidCount} - 出价次数
 * - {currentBot} - 当前机器人昵称
 */
export const replaceAuctionVariables = (
  content: string,
  auction: any,
  options: {
    currentBot?: string;
    endTime?: string;
    currentHighestBid?: number;
    bidCount?: number;
  } = {},
): string => {
  if (!content) return content;

  let result = content;

  // 基础变量
  const now = new Date();
  const beijingTime = formatBeijingDate(now);

  result = result
    .replace(/\{auctionTitle\}/g, escapeHtml(auction.title || ''))
    .replace(
      /\{startingPrice\}/g,
      escapeHtml(String(auction.startingPrice || 0)),
    )
    .replace(
      /\{minBidIncrement\}/g,
      escapeHtml(String(auction.minBidIncrement || 0)),
    )
    .replace(
      /\{maxBidIncrement\}/g,
      escapeHtml(String(auction.maxBidIncrement || 0)),
    )
    .replace(/\{endTime\}/g, escapeHtml(options.endTime || ''))
    .replace(
      /\{currentHighestBid\}/g,
      escapeHtml(
        String(options.currentHighestBid || auction.startingPrice || 0),
      ),
    )
    .replace(/\{bidCount\}/g, escapeHtml(String(options.bidCount || 0)))
    .replace(/\{currentTime\}/g, escapeHtml(beijingTime))
    .replace(/\{currentBot\}/g, escapeHtml(options.currentBot || ''));

  return result;
};
/**
 * 替换竞拍结束通知变量
 * - {auctionTitle} - 竞拍标题
 * - {winnerName} - 获胜者姓名
 * - {winningBid} - 获胜出价
 * - {totalBids} - 总出价次数
 * - {participantCount} - 参与人数
 * - {endTime} - 结束时间
 * - {currentBot} - 当前机器人昵称
 */
export const replaceAuctionEndVariables = (
  content: string,
  auction: any,
  options: {
    winnerName?: string;
    winningBid?: number;
    totalBids?: number;
    participantCount?: number;
    endTime?: string;
    currentBot?: string;
  } = {},
): string => {
  if (!content) return content;

  let result = content;

  // 基础变量
  const now = new Date();
  const beijingTime = formatBeijingDate(now);

  result = result
    .replace(/\{auctionTitle\}/g, escapeHtml(auction.title || ''))
    .replace(/\{winnerName\}/g, escapeHtml(options.winnerName || '未知用户'))
    .replace(/\{winningBid\}/g, escapeHtml(String(options.winningBid || 0)))
    .replace(/\{totalBids\}/g, escapeHtml(String(options.totalBids || 0)))
    .replace(
      /\{participantCount\}/g,
      escapeHtml(String(options.participantCount || 0)),
    )
    .replace(/\{endTime\}/g, escapeHtml(options.endTime || ''))
    .replace(/\{currentTime\}/g, escapeHtml(beijingTime))
    .replace(/\{currentBot\}/g, escapeHtml(options.currentBot || ''));

  return result;
};
