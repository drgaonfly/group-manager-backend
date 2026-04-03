import fs from 'fs/promises';
import path from 'path';
import { InputFile } from 'grammy';
import { MyContext } from '../../../types';
import Evaluation from '../../../../models/evaluation';
import createDebug from 'debug';

const debug = createDebug('bot:start:evaluation');

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
          });
          return;
        } catch (e) {
          debug('Media file not found:', imagePath);
        }
      }
    }

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (err) {
    debug('Handle evaluation deep link failed:', err);
    await ctx.reply('❌ 加载评价报告失败');
  }
}
