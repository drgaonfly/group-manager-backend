import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import Evaluation from '../../../../models/evaluation';
import Teacher from '../../../../models/teacher';
import { ITEMS_PER_PAGE } from '../../../../constants';
import { formatBeijingDate } from '../../../../utils/formatBeijingDate';
import { escapeHtml } from '../../../../utils/escapeHtml';
import createDebug from 'debug';

const debug = createDebug('bot:start:evaluation');

/**
 * 获取评价报告详情文本
 */
export function getEvaluationDetail(evaluation: any) {
  const teacher = evaluation.teacher as any;
  const teacherName =
    teacher?.display_name || teacher?.botUser?.userName || '老师';

  const reviewer = evaluation.reviewer as any;
  const reviewerName = evaluation.isReportedAnoymously
    ? '匿名'
    : reviewer?.userName
      ? `@${reviewer.userName}`
      : `${reviewer?.firstName || ''} ${reviewer?.lastName || ''}`.trim() ||
        '用户';

  const dateStr = evaluation.createdAt.toISOString().split('T')[0];

  const totalScore = Math.round(
    (evaluation.avatar_rating +
      evaluation.appearance_rating +
      evaluation.body_rating +
      evaluation.service_rating +
      evaluation.attitude_rating +
      evaluation.circumstance_rating) /
      3,
  );

  return [
    `<b>${escapeHtml('炮兵团专属车评')}</b>`,
    `<b>${escapeHtml('时间')}：</b>${escapeHtml(dateStr)}`,
    `<b>${escapeHtml('老师')}：</b>${escapeHtml(teacherName)}`,
    `<b>${escapeHtml('留名')}：</b>${escapeHtml(reviewerName)}`,
    `<b>${escapeHtml('人照')}：</b>${escapeHtml(evaluation.avatar_rating * 2)}`,
    `<b>${escapeHtml('颜值')}：</b>${escapeHtml(
      evaluation.appearance_rating * 2,
    )}`,
    `<b>${escapeHtml('身材')}：</b>${escapeHtml(evaluation.body_rating * 2)}`,
    `<b>${escapeHtml('服务')}：</b>${escapeHtml(
      evaluation.service_rating * 2,
    )}`,
    `<b>${escapeHtml('态度')}：</b>${escapeHtml(
      evaluation.attitude_rating * 2,
    )}`,
    `<b>${escapeHtml('环境')}：</b>${escapeHtml(
      evaluation.circumstance_rating * 2,
    )}`,
    `<b>${escapeHtml('综合')}：</b>${escapeHtml(totalScore)}`,
    `<b>${escapeHtml('过程')}：</b>${escapeHtml(evaluation.process_desc)}`,
  ].join('\n');
}

/**
 * 处理评价报告深链接
 * /start eval_ID
 */
export async function handleEvaluation(ctx: MyContext, evalId: string) {
  try {
    const evaluation = await Evaluation.findById(evalId)
      .populate('reviewer', 'userName firstName lastName')
      .populate({
        path: 'teacher',
        populate: { path: 'botUser' },
      });

    if (!evaluation || evaluation.status !== 'approved') {
      await ctx.reply('❌ 评价报告不存在或未通过审核');
      return;
    }

    // evaluation.teacher 已经 populate，取 _id 查原始 teacher 文档
    const teacherId = (evaluation.teacher as any)?._id ?? evaluation.teacher;
    const teacher = await Teacher.findById(teacherId);

    if (!teacher) {
      await ctx.reply('❌ 老师信息不存在');
      return;
    }

    const msg = getEvaluationDetail(evaluation);

    const keyboard = new InlineKeyboard();

    // 如果有媒体文件，增加查看照片按钮
    const hasMedia =
      (teacher.images && teacher.images.length > 0) ||
      (teacher.videos && teacher.videos.length > 0);
    if (hasMedia) {
      keyboard.text('🖼 查看照片', `show_teacher_media_${teacher._id}`).row();
    }

    keyboard.text('⬅️ 返回列表', `eval_list_${teacher._id}`);

    await ctx.reply(msg, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (err) {
    debug('Handle evaluation deep link failed:', err);
    await ctx.reply('❌ 加载评价报告失败');
  }
}

/**
 * 处理老师评价列表深链接
 * /start eval_list_TEACHER_ID
 */
export async function handleEvaluationList(
  ctx: MyContext,
  teacherId: string,
  isEdit = false,
  page = 1,
) {
  try {
    const query = {
      teacher: teacherId,
      status: 'approved',
    };

    const total = await Evaluation.countDocuments(query);
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    const evaluations = await Evaluation.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE);

    if (evaluations.length === 0 && page === 1) {
      await ctx.reply('🔍 该老师目前暂无评价报告。');
      return;
    }

    const teacherDoc = await Teacher.findById(teacherId);
    const teacherName = teacherDoc?.display_name || '老师';

    const msg = `查询到 ${teacherName} 相关的评价报告 (第 ${page}/${totalPages} 页)：`;
    const keyboard = new InlineKeyboard();

    evaluations.forEach((evalDoc, idx) => {
      const dateStr = formatBeijingDate(evalDoc.createdAt);
      const displayIdx = (page - 1) * ITEMS_PER_PAGE + idx + 1;
      keyboard
        .text(`评价报告 ${displayIdx} (${dateStr})`, `show_eval_${evalDoc._id}`)
        .row();
    });

    // 分页按钮
    const navButtons = [];
    if (page > 1) {
      navButtons.push(
        InlineKeyboard.text('⬅️ 上一页', `eval_list_${teacherId}_${page - 1}`),
      );
    }
    if (page < totalPages) {
      navButtons.push(
        InlineKeyboard.text('下一页 ➡️', `eval_list_${teacherId}_${page + 1}`),
      );
    }

    if (navButtons.length > 0) {
      keyboard.row(...navButtons);
    }

    if (isEdit) {
      await ctx.editMessageText(msg, {
        reply_markup: keyboard,
      });
    } else {
      await ctx.reply(msg, {
        reply_markup: keyboard,
      });
    }
  } catch (err) {
    debug('Handle evaluation list deep link failed:', err);
    await ctx.reply('❌ 加载评价列表失败');
  }
}
