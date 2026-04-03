import { Response } from 'express';
import Evaluation from '../models/evaluation';
// import Teacher from '../models/teacher';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';
import { setupBot } from '../bot/botSetup';
import { generateSignedUrl } from '../utils/generateSignedUrl';

/**
 * 获取评价列表
 */
export const getEvaluations = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10', botId, status } = req.query;
    const query: any = {};

    if (botId) query.bot = botId;
    if (status) query.status = status;

    const evaluations = await Evaluation.find(query)
      .populate('reviewer', 'id userName firstName lastName')
      .populate('teacher')
      .populate('bot', 'botName userName')
      .sort('-createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    const evaluationsWithUrls = await Promise.all(
      evaluations.map(async (evalDoc) => {
        const evalObj = evalDoc.toObject();

        // 转换图片路径
        if (evalObj.proof_media && evalObj.proof_media.length > 0) {
          evalObj.proof_media = await Promise.all(
            evalObj.proof_media.map((path: string) => generateSignedUrl(path)),
          );
        }
        return evalObj;
      }),
    );
    const total = await Evaluation.countDocuments(query);

    res.status(200).json({
      success: true,
      data: evaluationsWithUrls,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

/**
 * 审核通过评价
 */
export const approveEvaluation = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { id } = req.params;
    const { remark } = req.body;

    const evaluation = await Evaluation.findById(id)
      .populate('bot')
      .populate('reviewer')
      .populate('teacher');

    if (!evaluation) {
      res.status(404);
      throw new Error('评价不存在');
    }

    evaluation.status = 'approved';
    evaluation.remark = remark || '审核通过';
    await evaluation.save();

    // 通知用户
    try {
      const botDoc = evaluation.bot as any;
      const reviewer = evaluation.reviewer as any;
      if (botDoc && botDoc.token && reviewer && reviewer.id) {
        const bot = setupBot(botDoc.token);
        let msg = `✅ 您的评价已通过审核！`;
        if (evaluation.remark) {
          msg += `\n备注：${evaluation.remark}`;
        }
        await bot.api.sendMessage(reviewer.id, msg);
      }
    } catch (err) {
      console.error('Failed to notify reviewer:', err);
    }

    res.status(200).json({
      success: true,
      data: evaluation,
    });
  },
);

/**
 * 审核拒绝评价
 */
export const rejectEvaluation = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { id } = req.params;
    const { remark } = req.body;

    const evaluation = await Evaluation.findById(id)
      .populate('bot')
      .populate('reviewer');

    if (!evaluation) {
      res.status(404);
      throw new Error('评价不存在');
    }

    evaluation.status = 'rejected';
    evaluation.remark = remark || '审核未通过';
    await evaluation.save();

    // 通知用户
    try {
      const botDoc = evaluation.bot as any;
      const reviewer = evaluation.reviewer as any;
      if (botDoc && botDoc.token && reviewer && reviewer.id) {
        const bot = setupBot(botDoc.token);
        let msg = `❌ 您的评价未通过审核。`;
        if (evaluation.remark) {
          msg += `\n原因：${evaluation.remark}`;
        }
        await bot.api.sendMessage(reviewer.id, msg);
      }
    } catch (err) {
      console.error('Failed to notify reviewer:', err);
    }

    res.status(200).json({
      success: true,
      data: evaluation,
    });
  },
);

/**
 * 删除评价
 */
export const deleteEvaluation = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { id } = req.params;
    const evaluation = await Evaluation.findByIdAndDelete(id);

    if (!evaluation) {
      res.status(404);
      throw new Error('评价不存在');
    }

    res.status(200).json({
      success: true,
      message: '评价删除成功',
    });
  },
);
