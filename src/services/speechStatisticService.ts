import BotMessage from '../models/botMessage';
import BotUser from '../models/botUser';
import Group from '../models/group';
import SpeechConfig from '../models/speechConfig';

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
      displayDate = startDate.toLocaleDateString('zh-CN');
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

      const weekStart = startDate.toLocaleDateString('zh-CN');
      const weekEnd = new Date(endDate);
      weekEnd.setDate(weekEnd.getDate() - 1);
      displayDate = `${weekStart} - ${weekEnd.toLocaleDateString('zh-CN')}`;
    } else {
      // month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      displayDate = now.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
      });
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
   * 获取单个用户在群组中的发言统计
   */
  static async getBotUserSpeechStatistic(
    groupId: any,
    botUserId: any,
    period: 'day' | 'week' | 'month' = 'day',
    date?: Date,
  ): Promise<SpeechStatistic | null> {
    const { startDate, endDate, displayDate } = this.getDateRange(period, date);

    const messageCount = await BotMessage.countDocuments({
      group: groupId,
      botUser: botUserId,
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
    });

    const botUser = await BotUser.findById(botUserId);
    if (!botUser) return null;

    return {
      botUserId: botUserId.toString(),
      botUserName: botUser.userName || 'Unknown',
      displayName: botUser.displayName || 'Unknown',
      messageCount,
      period,
      date: displayDate,
    };
  }

  /**
   * 获取用户在所有群组中的发言统计
   */
  static async getBotUserTotalSpeechStatistic(
    botUserId: any,
    period: 'day' | 'week' | 'month' = 'day',
    date?: Date,
  ): Promise<{
    botUserId: string;
    displayName: string;
    totalMessages: number;
    groupStatistics: Array<{
      groupId: string;
      groupTitle: string;
      messageCount: number;
    }>;
    period: string;
    date: string;
  } | null> {
    const { startDate, endDate, displayDate } = this.getDateRange(period, date);

    const botUser = await BotUser.findById(botUserId);
    if (!botUser) return null;

    // 按群组分组统计
    const statistics = await BotMessage.aggregate([
      {
        $match: {
          botUser: botUserId,
          createdAt: {
            $gte: startDate,
            $lt: endDate,
          },
        },
      },
      {
        $group: {
          _id: '$group',
          messageCount: { $sum: 1 },
        },
      },
      {
        $sort: { messageCount: -1 },
      },
    ]);

    // 获取群组信息

    const groupIds = statistics.map((stat: any) => stat._id).filter(Boolean);
    const groups = await Group.find({ _id: { $in: groupIds } });
    const groupMap = new Map(groups.map((g: any) => [g._id.toString(), g]));

    const groupStatistics = statistics.map((stat: any) => {
      const group = groupMap.get(stat._id?.toString()) as any;
      return {
        groupId: stat._id?.toString() || 'unknown',
        groupTitle: group?.title || 'Unknown Group',
        messageCount: stat.messageCount,
      };
    });

    const totalMessages = groupStatistics.reduce(
      (sum, stat) => sum + stat.messageCount,
      0,
    );

    return {
      botUserId: botUserId.toString(),
      displayName: botUser.displayName || 'Unknown',
      totalMessages,
      groupStatistics,
      period,
      date: displayDate,
    };
  }

  /**
   * 获取排行榜（按发言数排序）
   */
  static async getLeaderboard(
    groupId: any,
    period: 'day' | 'week' | 'month' = 'day',
    limit: number = 10,
    date?: Date,
  ): Promise<SpeechStatistic[]> {
    const stats = await this.getGroupSpeechStatistics(groupId, period, date);
    if (!stats) return [];
    return stats.statistics.slice(0, limit);
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
