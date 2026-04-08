import { InlineKeyboard } from 'grammy';
import fs from 'fs/promises';
import path from 'path';
import { InputFile } from 'grammy';
import { MyContext } from '../../../types';
import Evaluation from '../../../../models/evaluation';
import { ITEMS_PER_PAGE } from '../../../../constants';
import { formatBeijingDate } from '../../../../utils/formatBeijingDate';
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

  let msg = `炮兵团专属车评\n`;
  msg += `【时间】：${dateStr}\n`;
  msg += `【老师】：${teacherName}\n`;
  msg += `【留名】：${reviewerName}\n`;
  msg += `【人照】：${evaluation.avatar_rating * 2}\n`;
  msg += `【颜值】：${evaluation.appearance_rating * 2}\n`;
  msg += `【身材】：${evaluation.body_rating * 2}\n`;
  msg += `【服务】：${evaluation.service_rating * 2}\n`;
  msg += `【态度】：${evaluation.attitude_rating * 2}\n`;
  msg += `【环境】：${evaluation.circumstance_rating * 2}\n`;
  msg += `【综合】：${Math.round(
    (evaluation.avatar_rating +
      evaluation.appearance_rating +
      evaluation.body_rating +
      evaluation.service_rating +
      evaluation.attitude_rating +
      evaluation.circumstance_rating) /
      3,
  )}\n`;
  msg += `【过程】：${evaluation.process_desc}`;
  return msg;
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

    const msg = getEvaluationDetail(evaluation);

    const keyboard = new InlineKeyboard().text(
      '⬅️ 返回列表',
      `eval_list_${(evaluation.teacher as any)?._id}`,
    );

    if (evaluation.proof_media && evaluation.proof_media.length > 0) {
      // 如果有媒体，发送第一张图片作为预览
      const firstMedia = evaluation.proof_media[0];
      const isImage = firstMedia.match(/\.(jpg|jpeg|png|webp)$/i);

      if (isImage) {
        const imagePath = path.join(process.cwd(), 'tmp', firstMedia);
        try {
          await fs.access(imagePath);
          await ctx.replyWithPhoto(new InputFile(imagePath), {
            caption: msg,
            parse_mode: 'Markdown',
            reply_markup: keyboard,
          });
          return;
        } catch (e) {
          debug('Media file not found:', imagePath);
        }
      }
    }

    await ctx.reply(msg, {
      parse_mode: 'Markdown',
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

    const teacher = await Evaluation.db.model('Teacher').findById(teacherId);
    const teacherName = teacher?.display_name || '老师';

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
