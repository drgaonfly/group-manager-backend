import { Types } from 'mongoose';
import BotUserConfig from '../models/botUserConfig';
import Badge from '../models/badge';
import { ITEMS_PER_PAGE } from '../constants';
import { MyContext } from '../bot/types';
import { escapeHtml } from '../utils/escapeHtml';

/**
 * 获取用户在特定群组内的积分排名
 * @param botId 机器人 ID
 * @param usdtBalance 当前用户的积分余额
 * @param groupBotUserIds 群组内的所有成员 ID 列表
 * @returns 排名数字（从 1 开始）
 */
export const getGroupUserRanking = async (
  botId: string | Types.ObjectId,
  usdtBalance: number,
  groupBotUserIds?: (string | Types.ObjectId)[],
): Promise<number | undefined> => {
  if (!groupBotUserIds || groupBotUserIds.length === 0) {
    return undefined;
  }

  const rank = await BotUserConfig.countDocuments({
    bot: botId,
    botUser: { $in: groupBotUserIds },
    usdt_balance: { $gt: usdtBalance },
  });

  return rank + 1;
};

/**
 * 获取特定群组内的积分榜单
 * @param botId 机器人 ID
 * @param groupBotUserIds 群组内的所有成员 ID 列表
 * @param page 页码（从 1 开始）
 * @param limit 每页数量
 * @returns 格式化后的榜单字符串和是否有下一页
 */
export const getGroupUserRankingList = async (
  ctx: MyContext,
  botId: string | Types.ObjectId,
  groupBotUserIds?: (string | Types.ObjectId)[],
  page: number = 1,
  limit: number = ITEMS_PER_PAGE,
  overrideBalance?: number, // 签到后传入最新积分，避免读到 ctx 中的旧缓存值
): Promise<{ text: string; hasNext: boolean; total: number }> => {
  if (!groupBotUserIds || groupBotUserIds.length === 0) {
    return { text: '暂无榜单数据', hasNext: false, total: 0 };
  }

  const total = await BotUserConfig.countDocuments({
    bot: botId,
    botUser: { $in: groupBotUserIds },
  });

  const skip = (page - 1) * limit;

  const configs = await BotUserConfig.find({
    bot: botId,
    botUser: { $in: groupBotUserIds },
  })
    .sort({ usdt_balance: -1 })
    .skip(skip)
    .limit(limit)
    .populate('botUser');

  if (configs.length === 0) {
    return { text: '暂无榜单数据', hasNext: false, total };
  }

  const list = configs
    .map((config: any, index: number) => {
      const botUser = config.botUser;
      const nickname = botUser?.displayName || `用户${botUser?.id || ''}`;
      const balance = config.usdt_balance || 0;
      const safeNickname = escapeHtml(nickname);

      const href = botUser?.id
        ? `tg://user?id=${encodeURIComponent(String(botUser.id))}`
        : botUser?.userName
          ? `https://t.me/${encodeURIComponent(String(botUser.userName))}`
          : '';

      const nicknameText = href
        ? `<a href="${href}">${safeNickname}</a>`
        : safeNickname;
      return `${skip + index + 1}、 ${nicknameText}  ${balance}`;
    })
    .join('\n');

  const usdtBalance =
    overrideBalance ?? ctx.currentBotUserConfig?.usdt_balance ?? 0;

  const ranking = await getGroupUserRanking(
    botId,
    usdtBalance,
    groupBotUserIds,
  );

  const message = [
    `您当前的积分为: ${usdtBalance}，在本群的排名为：${ranking || ''}`,
    '',
    '本群积分榜如下：',
    '',
    list,
  ].join('\n');

  return {
    text: message,
    hasNext: skip + configs.length < total,
    total,
  };
};

/**
 * 根据用户当前积分，查询该 bot 下匹配的最高称号
 * 规则：找出所有 threshold <= balance 的称号，取 threshold 最大的那个
 * @param botId 机器人 ID
 * @param balance 用户当前积分
 * @returns 称号名称字符串，未匹配时返回空字符串
 */
export const getUserCurrentRank = async (
  botId: string | Types.ObjectId,
  balance: number,
): Promise<string> => {
  const badge = await Badge.findOne({
    bot: botId,
    threshold: { $lte: balance },
  })
    .sort({ threshold: -1 }) // 取门槛最高的（最高等级）
    .select('title')
    .lean();

  return badge?.title ?? '';
};
