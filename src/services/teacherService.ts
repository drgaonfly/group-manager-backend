import Teacher from '../models/teacher';
import BotUser from '../models/botUser';
import { Types } from 'mongoose';

export interface TeacherSearchResult {
  teachers: any[];
  message: string;
}

/**
 * 抽象出的老师搜索逻辑
 * @param query 搜索关键词
 * @param botId 当前机器人ID
 * @returns 搜索结果和格式化消息
 */
export const searchTeachers = async (
  query: string,
  botId: string | Types.ObjectId,
): Promise<TeacherSearchResult> => {
  if (!query) {
    return {
      teachers: [],
      message: '请输入要搜索的老师用户名或姓名',
    };
  }

  // 处理用户名搜索，去掉开头的 @ 符号
  const searchName = query.startsWith('@') ? query.slice(1) : query;

  // 1. 在 BotUser 中模糊搜索
  const botUsers = await BotUser.find({
    $or: [
      { userName: { $regex: searchName, $options: 'i' } },
      { firstName: { $regex: query, $options: 'i' } },
      { lastName: { $regex: query, $options: 'i' } },
    ],
  }).select('_id');

  // 2. 同时在 Teacher 的 display_name 字段中搜索
  const displayNameTeachers = await Teacher.find({
    bot: botId,
    status: 'approved',
    display_name: { $regex: query, $options: 'i' },
  }).select('botUser');

  const teacherBotUserIds = displayNameTeachers.map((t) => t.botUser);
  const botUserIds = [
    ...new Set([...botUsers.map((u) => u._id), ...teacherBotUserIds]),
  ];

  if (botUserIds.length === 0) {
    return { teachers: [], message: '未找到匹配的用户或老师信息' };
  }

  // 3. 在 Teacher 中查找，只找已审核通过的
  const teachers = await Teacher.find({
    bot: botId,
    botUser: { $in: botUserIds },
    status: 'approved',
  })
    .populate('botUser')
    .sort({ updatedAt: -1 })
    .limit(10);

  if (teachers.length === 0) {
    return { teachers: [], message: '未找到相关的认证老师' };
  }

  // 4. 格式化消息内容
  const messageRows = [
    `🔍 搜索结果：`,
    '',
    ...teachers.map((t: any, idx) => {
      const name =
        t.display_name ||
        (t.botUser?.userName
          ? `@${t.botUser.userName}`
          : `${t.botUser?.firstName || ''} ${
              t.botUser?.lastName || ''
            }`.trim()) ||
        '未知用户';

      const status = t.isAvailable ? '✅ 可接单' : '❌ 忙碌中';
      return [
        `*${idx + 1}. ${name}*`,
        `状态：${status}`,
        `联系方式：${t.contactLink || '未设置'}`,
        `详细信息：\n${t.brief || '无'}`,
      ].join('\n');
    }),
  ];

  return {
    teachers,
    message: messageRows.join('\n\n'),
  };
};
