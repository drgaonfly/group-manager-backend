import BotMessage from '../models/botMessage';
import BotUser from '../models/botUser';
import Group from '../models/group';
import SpeechConfig from '../models/speechConfig';
import { formatBeijingDate } from '../utils/formatBeijingDate';

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
    const now = date ? new Date(date) : new Date();

    let startDate: Date;
    let endDate: Date;
    let displayDate: string;

    if (period === 'day') {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      displayDate = formatBeijingDate(startDate);
    } else if (period === 'week') {
      // 获取本周的开始（周一）
      const tempDate = new Date(now);
      const dayOfWeek = tempDate.getDay();
      const diff = tempDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      startDate = new Date(tempDate);
      startDate.setDate(diff);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);

      const weekStart = formatBeijingDate(startDate);
      const weekEnd = new Date(endDate);
      weekEnd.setDate(weekEnd.getDate() - 1);
      displayDate = `${weekStart} - ${formatBeijingDate(weekEnd)}`;
    } else {
      // month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      displayDate = formatBeijingDate(now);
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

    // 优先从 SpeechConfig（群级配置）读取过滤参数，无配置时使用默认值
    const speechConfig = await SpeechConfig.findOne({
      bot: group.bot,
      group: groupId,
    }).lean();

    const minSpeechLength: number = speechConfig?.minSpeechLength ?? 1;
    const allowPureNumberSpeech: boolean =
      speechConfig?.allowPureNumberSpeech ?? false;

    // 构建匹配条件
    const matchConditions: any = {
      group: groupId,
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      // 内容长度至少 minSpeechLength 个字符
      $expr: { $gte: [{ $strLenCP: '$content' }, minSpeechLength] },
    };

    // 如果不允许纯数字发言，添加过滤条件
    if (!allowPureNumberSpeech) {
      matchConditions.content = { $not: /^\d+$/ };
    }

    // 聚合查询：按 botUser 分组统计消息数
    const statistics = await BotMessage.aggregate([
      {
        $match: matchConditions,
      },
      {
        $group: {
          _id: '$botUser',
          messageCount: { $sum: 1 },
        },
      },
      {
        $sort: { messageCount: -1 },
      },
    ]);

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

    const totalMessages = speechStats.reduce(
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
  ): Promise<{
    groupId: string;
    groupTitle: string;
    period: 'day' | 'week' | 'month';
    date: string;
    statistics: SpeechStatistic[];
    totalMessages: number;
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  } | null> {
    const stats = await this.getGroupSpeechStatistics(groupId, period, date);
    if (!stats) return null;

    const totalPages = Math.ceil(stats.statistics.length / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageStatistics = stats.statistics.slice(startIndex, endIndex);

    return {
      groupId: stats.groupId,
      groupTitle: stats.groupTitle,
      period: stats.period,
      date: stats.date,
      statistics: pageStatistics,
      totalMessages: stats.totalMessages,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }
}
