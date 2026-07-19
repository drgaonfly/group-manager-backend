import BotMessage from '../models/botMessage';
import BotUser from '../models/botUser';
import Group from '../models/group';
import SpeechConfig from '../models/speechConfig';
import { formatBeijingDate } from '../utils/formatBeijingDate';
import { getPeriodRange } from '../utils/dateHelper';
import dayjs from 'dayjs';

export interface SpeechStatistic {
  botUserId: string;
  botUserName: string;
  displayName: string;
  messageCount: number;
  period: 'day' | 'week' | 'month';
  date: string;
}

export interface GroupSpeechStatistics {
  groupId: string;
  groupTitle: string;
  period: 'day' | 'week' | 'month';
  date: string;
  statistics: SpeechStatistic[];
  totalMessages: number;
}

/**
 * 发言统计服务
 * 提供群组发言数据的统计和分页功能
 */
export class SpeechStatisticService {
  /**
   * 获取指定时间范围内的消息统计
   */
  private static getDateRange(
    period: 'day' | 'week' | 'month',
    date?: Date,
  ): { startDate: Date; endDate: Date; displayDate: string } {
    const { startDate, endDate } = getPeriodRange(
      period === 'day' ? 'daily' : period === 'week' ? 'weekly' : 'monthly',
      date,
    );

    let displayDate: string;
    if (period === 'week') {
      const weekEnd = dayjs(endDate).subtract(1, 'millisecond');
      displayDate = `${formatBeijingDate(startDate)} - ${formatBeijingDate(
        weekEnd.toDate(),
      )}`;
    } else {
      displayDate = formatBeijingDate(startDate);
    }

    return { startDate, endDate, displayDate };
  }

  /**
   * 获取群组中所有用户的发言统计
   */
  static async getGroupSpeechStatistics(
    groupId: any,
    period: 'day' | 'week' | 'month' = 'day',
    date?: Date,
  ): Promise<GroupSpeechStatistics | null> {
    const { startDate, endDate, displayDate } = this.getDateRange(period, date);

    const group = await Group.findById(groupId);
    if (!group) return null;

    // 并行查询 SpeechConfig
    const speechConfig = await SpeechConfig.findOne({
      bot: group.bot,
      group: groupId,
    }).lean();

    const minSpeechLength = speechConfig?.minSpeechLength ?? 1;
    const allowPureNumberSpeech = speechConfig?.allowPureNumberSpeech ?? false;

    // 构建匹配条件
    const matchConditions: any = {
      group: groupId,
      createdAt: { $gte: startDate, $lt: endDate },
      $expr: { $gte: [{ $strLenCP: '$content' }, minSpeechLength] },
    };

    if (!allowPureNumberSpeech) {
      matchConditions.content = { $not: /^\d+$/ };
    }

    // 聚合查询：按 botUser 分组统计消息数
    const statistics = await BotMessage.aggregate([
      { $match: matchConditions },
      { $group: { _id: '$botUser', messageCount: { $sum: 1 } } },
      { $sort: { messageCount: -1 } },
    ]);

    if (statistics.length === 0) {
      return {
        groupId: groupId.toString(),
        groupTitle: group.title,
        period,
        date: displayDate,
        statistics: [],
        totalMessages: 0,
      };
    }

    // 获取 botUser 详细信息
    const botUserIds = statistics.map((stat) => stat._id);
    const botUsers = await BotUser.find({ _id: { $in: botUserIds } });

    const botUserMap = new Map(
      botUsers.map((user: any) => [user._id.toString(), user]),
    );

    const speechStats: SpeechStatistic[] = statistics.map((stat: any) => {
      const botUser = botUserMap.get(stat._id.toString()) as any;
      return {
        botUserId: stat._id.toString(),
        botUserName: botUser?.userName || 'Unknown',
        displayName: botUser?.displayName || 'Unknown',
        messageCount: stat.messageCount,
        period,
        date: displayDate,
      };
    });

    const totalMessages = statistics.reduce(
      (sum, stat) => sum + stat.messageCount,
      0,
    );

    return {
      groupId: groupId.toString(),
      groupTitle: group.title,
      period,
      date: displayDate,
      statistics: speechStats,
      totalMessages,
    };
  }

  /**
   * 获取分页的群组发言统计
   */
  static async getGroupSpeechStatisticsPaginated(
    groupId: any,
    period: 'day' | 'week' | 'month' = 'day',
    page: number = 1,
    pageSize: number = 10,
    date?: Date,
  ) {
    const stats = await this.getGroupSpeechStatistics(groupId, period, date);
    if (!stats) return null;

    const totalPages = Math.ceil(stats.statistics.length / pageSize);
    const startIndex = (page - 1) * pageSize;
    const pageStatistics = stats.statistics.slice(
      startIndex,
      startIndex + pageSize,
    );

    return {
      ...stats,
      statistics: pageStatistics,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }
}
