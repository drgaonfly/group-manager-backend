import Teacher from '../models/teacher';
import Evaluation from '../models/evaluation';
import { Types } from 'mongoose';
import dayjs from 'dayjs';

export interface TeacherSearchResult {
  teachers: any[];
  message: string;
  botUserName?: string;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 抽象出的老师搜索逻辑（仅按老师花名 display_name 匹配，不按 Telegram 用户或地址反查，
 * 避免多名老师共用同一经纪人/注册账号时被一次全部搜出。）
 * @param query 搜索关键词（花名，可含 @ 前缀，会忽略 @ 仅比对花名字符串）
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
      message: '请输入要搜索的老师花名',
    };
  }

  const nameQuery = query.startsWith('@')
    ? query.slice(1).trim()
    : query.trim();
  if (!nameQuery) {
    return { teachers: [], message: '请输入要搜索的老师花名' };
  }

  const namePattern = new RegExp(escapeRegExp(nameQuery), 'i');

  const teachers = await Teacher.find({
    bot: botId,
    status: 'approved',
    $or: [{ display_name: namePattern }, { address: namePattern }],
  })
    .populate('botUser')
    .populate('bot', 'userName')
    .sort({ updatedAt: -1 })
    .limit(10);

  if (teachers.length === 0) {
    return { teachers: [], message: '未找到花名匹配的认证老师' };
  }

  const botUserName = (teachers[0].bot as any)?.userName;

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
      const rows = [
        `*${idx + 1}. ${name}*`,
        `状态：${status}`,
        `地点：${t.address || '未设置'}`,
        `联系方式：${t.contactLink || '未设置'}`,
        `详细信息：\n${t.brief || '无'}`,
      ];

      return rows.join('\n');
    }),
  ];

  return {
    teachers,
    message: messageRows.join('\n\n'),
    botUserName,
  };
};

/**
 * 获取老师的评价报告列表文本（带深链接）
 */
export const getTeacherEvaluationsText = async (
  teacherId: string | Types.ObjectId,
  botUserName: string,
): Promise<string | null> => {
  const evaluations = await Evaluation.find({
    teacher: teacherId,
    status: 'approved',
  })
    .sort({ createdAt: -1 })
    .limit(5);

  if (evaluations.length === 0) return null;

  const teacher = await Teacher.findById(teacherId).populate('botUser');
  if (!teacher) return null;

  const name =
    teacher.display_name || (teacher.botUser as any)?.userName || '老师';

  const rows = [`查询到${name}相关的评价报告${evaluations.length}份：`];

  rows.push('');

  evaluations.forEach((evalDoc, idx) => {
    const dateStr = dayjs(evalDoc.createdAt).format('YYYY-MM-DD');
    // 构建深链接: https://t.me/botname?start=eval_ID
    const deepLink = `https://t.me/${botUserName}?start=eval_${evalDoc._id}`;
    rows.push(`[评价报告${idx + 1}：${dateStr}](${deepLink})`);
  });

  rows.push('');
  rows.push('第1/1页');

  return rows.join('\n');
};
