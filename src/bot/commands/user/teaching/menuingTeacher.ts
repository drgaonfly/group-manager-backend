import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import { checkTeaching } from '../../../middlewares/checkTeaching';
import { ITEMS_PER_PAGE } from '../../../../constants';
import Teacher from '../../../../models/teacher';
import Evaluation from '../../../../models/evaluation';
import createDebug from 'debug';

const debug = createDebug('bot:teaching:menuingTeacher');
const menuingTeacherCommand = new Composer<MyContext>();

type Period = 'month' | 'quarter' | 'year';

const PERIOD_LABELS: Record<Period, string> = {
  month: '本月',
  quarter: '本季度',
  year: '本年',
};

function getPeriodStartDate(period: Period): Date {
  const now = new Date();
  switch (period) {
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'quarter': {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return new Date(now.getFullYear(), quarterStartMonth, 1);
    }
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
  }
}

const getTeacherMenu = async (ctx: MyContext, page: number, period: Period) => {
  // 1. 获取所有已审核通过的老师
  const teachers = await Teacher.find({
    bot: ctx.currentBot!._id,
    status: 'approved',
  }).populate('botUser');

  if (teachers.length === 0) {
    return { text: '暂无在线老师', keyboard: null };
  }

  const since = getPeriodStartDate(period);

  // 2. 计算每个老师在指定时间范围内的平均评分
  const teachersWithRatings = await Promise.all(
    teachers.map(async (teacher) => {
      const baseQuery = { teacher: teacher._id, status: 'approved' };
      const rangedQuery = {
        ...baseQuery,
        createdAt: { $gte: since },
      };

      const [evaluations, evaluationCount] = await Promise.all([
        Evaluation.find(rangedQuery).sort({ createdAt: -1 }).limit(10),
        Evaluation.countDocuments(rangedQuery),
      ]);

      let averageRating = 0;
      if (evaluations.length > 0) {
        const totalRating = evaluations.reduce((sum, evaluation) => {
          return (
            sum +
            (evaluation.avatar_rating +
              evaluation.appearance_rating +
              evaluation.body_rating +
              evaluation.service_rating +
              evaluation.attitude_rating +
              evaluation.circumstance_rating) /
              6
          );
        }, 0);
        averageRating = totalRating / evaluations.length;
      }

      const teacherObj = teacher.toObject();
      return {
        ...teacherObj,
        averageRating,
        evaluationCount,
      };
    }),
  );

  // 3. 按评分由高到低排序，评分相同时按评价数量排序，最后按注册时间排序
  const sortedTeachers = teachersWithRatings.sort((a, b) => {
    if (b.averageRating !== a.averageRating) {
      return b.averageRating - a.averageRating;
    }
    if (b.evaluationCount !== a.evaluationCount) {
      return b.evaluationCount - a.evaluationCount;
    }
    const aTime = (a as any).createdAt || new Date(0);
    const bTime = (b as any).createdAt || new Date(0);
    return new Date(aTime).getTime() - new Date(bTime).getTime(); // 注册早的靠前
  });

  const totalPages = Math.ceil(sortedTeachers.length / ITEMS_PER_PAGE);
  const start = (page - 1) * ITEMS_PER_PAGE;
  const paginatedTeachers = sortedTeachers.slice(start, start + ITEMS_PER_PAGE);

  // 4. 构建消息文本
  const messageText = [
    `📋 <b>老师榜单</b>（${PERIOD_LABELS[period]}评分排序）`,
    `状态说明：🟢可约  🔴休息中`,
    ``,
    `💡 点击按钮联系老师`,
    `发送：<b>老师 名字</b> 可查看老师详情`,
    `发送：<b>老师飞机号</b> 可查看该老师所有评价`,
  ].join('\n');

  // 5. 构建内联键盘
  const keyboard = new InlineKeyboard();

  // 时间范围切换按钮（顶部一行三个）
  (['month', 'quarter', 'year'] as Period[]).forEach((p) => {
    const label = p === period ? `✅ ${PERIOD_LABELS[p]}` : PERIOD_LABELS[p];
    keyboard.text(label, `teachers_page:1:${p}`);
  });
  keyboard.row();

  // 老师列表（每行一个）
  let rank = start;
  paginatedTeachers.forEach((teacher: any) => {
    const botUser = teacher.botUser;
    if (!botUser) {
      debug('Teacher %s has no botUser, skipping', teacher._id);
      return;
    }

    rank++;
    const name = teacher.display_name || botUser.userName || '未知';
    const statusIcon = teacher.isAvailable ? '🟢' : '🔴';
    const ratingText =
      teacher.averageRating > 0
        ? ` ⭐${teacher.averageRating.toFixed(1)}(${teacher.evaluationCount})`
        : '';

    keyboard.url(
      `${rank}. ${statusIcon} ${name}${ratingText}`,
      teacher.contactLink || `https://t.me/${botUser?.userName || ''}`,
    );
    keyboard.row();
  });

  // 分页按钮
  if (totalPages > 1) {
    if (page > 1) {
      keyboard.text('⬅️ 上一页', `teachers_page:${page - 1}:${period}`);
    }
    if (page < totalPages) {
      keyboard.text('➡️ 下一页', `teachers_page:${page + 1}:${period}`);
    }
    keyboard.row();
  }

  return { text: messageText, keyboard };
};

menuingTeacherCommand.hears('老师', checkTeaching, async (ctx) => {
  debug('menuing teacher triggered in group:', ctx.chat.id);

  // 删除旧的消息（如果 session 中存有 message_id）
  const lastMessageId = ctx.session.lastTeacherMenuId;
  if (lastMessageId) {
    try {
      await ctx.api.deleteMessage(ctx.chat.id, lastMessageId);
    } catch (e) {
      debug('Failed to delete old teacher menu message:', e);
    }
  }

  const { text, keyboard } = await getTeacherMenu(ctx, 1, 'month');
  const sentMessage = await ctx.reply(text, {
    reply_markup: keyboard || undefined,
    parse_mode: 'HTML',
  });

  ctx.session.lastTeacherMenuId = sentMessage.message_id;

  // 阅后即焚
  const firstTeacher = await Teacher.findOne({
    bot: ctx.currentBot!._id,
    status: 'approved',
  });
  const burnSeconds = firstTeacher?.menuDeleteAfterSeconds ?? 30;

  if (burnSeconds > 0 && ctx.chat) {
    const chatId = ctx.chat.id;
    const messageId = sentMessage.message_id;
    const api = ctx.api;
    setTimeout(() => {
      api.deleteMessage(chatId, messageId).catch((err) => {
        debug('teacher menu auto-delete failed:', err);
      });
    }, burnSeconds * 1000);
  }
});

menuingTeacherCommand.callbackQuery(
  /^teachers_page:(\d+):(month|quarter|year)$/,
  async (ctx) => {
    const page = parseInt(ctx.match[1]);
    const period = ctx.match[2] as Period;
    const { text, keyboard } = await getTeacherMenu(ctx, page, period);

    try {
      await ctx.editMessageText(text, {
        reply_markup: keyboard || undefined,
        parse_mode: 'HTML',
      });
    } catch (error) {
      debug('Error editing message:', error);
    }
    await ctx.answerCallbackQuery();
  },
);

export default menuingTeacherCommand;
