import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import { checkGroup } from '../../../middlewares/checkGroup';
import { checkTeaching } from '../../../middlewares/checkTeaching';
import Teacher from '../../../../models/teacher';
import Evaluation from '../../../../models/evaluation';
import { ITEMS_PER_PAGE } from '../../../../constants';
import createDebug from 'debug';

const debug = createDebug('bot:teaching:menuingTeacher');
const menuingTeacherCommand = new Composer<MyContext>();

const getTeacherMenu = async (ctx: MyContext, page: number) => {
  // 1. 获取所有已审核通过的老师
  const teachers = await Teacher.find({
    bot: ctx.currentBot!._id,
    status: 'approved',
  }).populate('botUser');

  if (teachers.length === 0) {
    return { text: '暂无在线老师', keyboard: null };
  }

  // 2. 计算每个老师的平均评分
  const teachersWithRatings = await Promise.all(
    teachers.map(async (teacher) => {
      const evaluations = await Evaluation.find({
        teacher: teacher._id,
        status: 'approved',
      });

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
          ); // 6个维度的平均分
        }, 0);
        averageRating = totalRating / evaluations.length;
      }

      const teacherObj = teacher.toObject();
      return {
        ...teacherObj,
        averageRating,
        evaluationCount: evaluations.length,
      };
    }),
  );

  // 3. 按评分由高到低排序，评分相同时按评价数量排序，最后按更新时间排序
  const sortedTeachers = teachersWithRatings.sort((a, b) => {
    if (b.averageRating !== a.averageRating) {
      return b.averageRating - a.averageRating;
    }
    if (b.evaluationCount !== a.evaluationCount) {
      return b.evaluationCount - a.evaluationCount;
    }
    // 使用 createdAt 或 _id 作为最后的排序依据
    const aTime = (a as any).updatedAt || (a as any).createdAt || new Date();
    const bTime = (b as any).updatedAt || (b as any).createdAt || new Date();
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  const totalPages = Math.ceil(sortedTeachers.length / ITEMS_PER_PAGE);
  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const paginatedTeachers = sortedTeachers.slice(start, end);

  // 4. 构建消息文本
  const messageText = [
    `以下为所有老师（按评分排序）：`,
    `状态说明： 🟢可约  🔴休息中`,
    ``,
    `发送：**<b>老师</b> 名字** 可以跳出老师描述和榜单`,
    `发送：**<b>老师飞机号</b>** 可以查看老师名下所有车评`,
  ].join('\n');

  // 5. 构建内联键盘 (一行三个)
  const keyboard = new InlineKeyboard();

  paginatedTeachers.forEach((teacher: any, index) => {
    const botUser = teacher.botUser;
    const name = teacher.display_name || botUser.userName;
    const statusIcon = teacher.isAvailable ? '🟢' : '🔴';

    // 显示评分信息
    const ratingText =
      teacher.averageRating > 0
        ? ` ⭐${teacher.averageRating.toFixed(1)}(${teacher.evaluationCount})`
        : '';

    const buttonText = `${statusIcon} ${name}${ratingText}`;

    keyboard.url(
      buttonText,
      teacher.contactLink || `https://t.me/${botUser?.userName || ''}`,
    );

    if ((index + 1) % 3 === 0) {
      keyboard.row();
    }
  });

  // 6. 添加分页按钮
  if (totalPages > 1) {
    keyboard.row();
    if (page > 1) {
      keyboard.text('⬅️ 上一页', `teachers_page:${page - 1}`);
    }
    if (page < totalPages) {
      keyboard.text('➡️ 下一页', `teachers_page:${page + 1}`);
    }
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

  const { text, keyboard } = await getTeacherMenu(ctx, 1);
  const sentMessage = await ctx.reply(text, {
    reply_markup: keyboard || undefined,
    parse_mode: 'HTML',
  });

  // 保存新的 message_id 到 session
  ctx.session.lastTeacherMenuId = sentMessage.message_id;

  // 获取该机器人下任意一个老师的阅后即焚时间（因为所有老师共用同一个值）
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

menuingTeacherCommand.callbackQuery(/^teachers_page:(\d+)$/, async (ctx) => {
  const page = parseInt(ctx.match[1]);
  const { text, keyboard } = await getTeacherMenu(ctx, page);

  try {
    await ctx.editMessageText(text, {
      reply_markup: keyboard || undefined,
      parse_mode: 'HTML',
    });
  } catch (error) {
    debug('Error editing message:', error);
  }
  await ctx.answerCallbackQuery();
});

export default menuingTeacherCommand;
