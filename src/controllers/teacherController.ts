import { generateSignedUrl } from '../utils/generateSignedUrl';
import { Request, Response } from 'express';
import Evaluation from '../models/evaluation';
import BotUser from '../models/botUser';
import Teacher from '../models/teacher';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from '../types/user';
import { getUserByUsername } from '../utils/getBotUserByUsername';
import Bot from '../models/bot';

// ── 共享辅助函数 ───────────────────────────────────────────────────

/** 计算单条评价的六维平均分 */
export function calcEvalAvg(e: any): number {
  return (
    (e.avatar_rating +
      e.appearance_rating +
      e.body_rating +
      e.service_rating +
      e.attitude_rating +
      e.circumstance_rating) /
    6
  );
}

/** 将时间段字符串转为起始 Date */
export function getPeriodStart(period: string): Date {
  const now = new Date();
  if (period === 'quarter') {
    const m = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), m, 1);
  }
  if (period === 'year') {
    return new Date(now.getFullYear(), 0, 1);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1); // month (default)
}

/** 批量将存储路径转为签名 URL */
export async function signImages(images: string[]): Promise<string[]> {
  if (!images?.length) return [];
  return Promise.all(images.map((p) => generateSignedUrl(p)));
}

/** 规范化 Telegram 联系链接 */
export function normalizeContactLink(input: string): string | null {
  const text = input.trim();
  if (/^https:\/\/t\.me\/[A-Za-z0-9_]{3,}$/.test(text)) return text;
  if (/^@[A-Za-z0-9_]{3,}$/.test(text)) return `https://t.me/${text.slice(1)}`;
  if (/^[A-Za-z0-9_]{3,}$/.test(text)) return `https://t.me/${text}`;
  return null;
}

/**
 * 获取所有老师（支持分页和机器人过滤）
 */
export const getTeachers = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10', botId } = req.query;
    const query: any = {};

    if (botId) {
      query.bot = botId;
    }

    const teachers = await Teacher.find(query)
      .populate('botUser', 'id userName firstName lastName')
      .populate('bot', 'botName userName')
      .sort('-updatedAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    const teachersWithUrls = await Promise.all(
      teachers.map(async (teacher) => {
        const teacherObj = teacher.toObject();

        // 转换图片路径
        if (teacherObj.images && teacherObj.images.length > 0) {
          teacherObj.images = await Promise.all(
            teacherObj.images.map((path: string) => generateSignedUrl(path)),
          );
        }

        // 转换视频路径
        if (teacherObj.videos && teacherObj.videos.length > 0) {
          teacherObj.videos = await Promise.all(
            teacherObj.videos.map((path: string) => generateSignedUrl(path)),
          );
        }
        return teacherObj;
      }),
    );

    const total = await Teacher.countDocuments(query);

    res.status(200).json({
      success: true,
      data: teachersWithUrls,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

/**
 * 获取单个老师详情
 */
export const getTeacherById = handleAsync(
  async (req: Request, res: Response) => {
    const teacher = await Teacher.findById(req.params.id)
      .populate('botUser', 'id userName firstName lastName')
      .populate('bot', 'botName userName');

    if (!teacher) {
      res.status(404);
      throw new Error('老师不存在');
    }

    res.status(200).json({
      success: true,
      data: teacher,
    });
  },
);

/**
 * 添加老师
 */
export const addTeacher = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { username, ...rest } = req.body;
    const data = {
      ...rest,
      proxy: req.user._id,
      status: 'approved', // 后台添加直接审核通过
    };

    if (username && !data.botUser) {
      const bot = await Bot.findById(data.bot);
      if (!bot) throw new Error('机器人不存在');

      console.log('bot.session', bot.session);

      const botUser_data = await getUserByUsername(
        bot.token,
        username.replace('@', ''),
      );

      // 查找或创建 BotUser
      let botUserDoc = await BotUser.findOne({
        id: botUser_data.id.toString(),
      });
      if (!botUserDoc) {
        botUserDoc = await BotUser.create({
          id: botUser_data.id.toString(),
          userName: botUser_data.username,
          firstName: botUser_data.first_name,
          lastName: botUser_data.last_name,
        });
      }
      data.botUser = botUserDoc._id;
    }

    const teacher = await Teacher.findOneAndUpdate(
      {
        bot: data.bot,
        botUser: data.botUser,
      },
      { $set: data },
      { new: true, upsert: true, runValidators: true },
    );
    res.status(201).json({
      success: true,
      data: teacher,
    });
  },
);

/**
 * 更新老师信息
 */
export const updateTeacher = handleAsync(
  async (req: Request, res: Response) => {
    const teacher = await Teacher.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!teacher) {
      res.status(404);
      throw new Error('老师不存在');
    }

    res.status(200).json({
      success: true,
      data: teacher,
    });
  },
);

/**
 * 删除老师
 */
export const deleteTeacher = handleAsync(
  async (req: Request, res: Response) => {
    const teacher = await Teacher.findByIdAndDelete(req.params.id);

    if (!teacher) {
      res.status(404);
      throw new Error('老师不存在');
    }

    // 同时删除该老师关联的所有评价
    await Evaluation.deleteMany({ teacher: req.params.id });

    res.status(200).json({
      success: true,
      data: { message: '老师及关联评价删除成功' },
    });
  },
);

/**
 * 批量删除老师
 */
export const deleteMultipleTeachers = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400);
      throw new Error('请提供要删除的老师 ID 列表');
    }

    await Teacher.deleteMany({ _id: { $in: ids } });

    // 同时删除这些老师关联的所有评价
    await Evaluation.deleteMany({ teacher: { $in: ids } });

    res.status(200).json({
      success: true,
      message: `成功删除 ${ids.length} 个老师及其关联评价`,
    });
  },
);

/**
 * 审核通过老师
 */
export const approveTeacher = handleAsync(
  async (req: Request, res: Response) => {
    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      { status: 'approved' },
      { new: true, runValidators: true },
    );

    if (!teacher) {
      res.status(404);
      throw new Error('老师不存在');
    }

    res.status(200).json({
      success: true,
      data: teacher,
    });
  },
);

/**
 * 审核拒绝老师
 */
export const rejectTeacher = handleAsync(
  async (req: Request, res: Response) => {
    const { remark } = req.body;
    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', remark: remark || '' },
      { new: true, runValidators: true },
    );

    if (!teacher) {
      res.status(404);
      throw new Error('老师不存在');
    }

    res.status(200).json({
      success: true,
      data: teacher,
    });
  },
);

/**
 * 批量更新老师的阅后即焚时间
 */
export const batchUpdateBurnSeconds = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { botId, menuDeleteAfterSeconds } = req.body;

    if (!botId) {
      res.status(400);
      throw new Error('机器人 ID 不能为空');
    }

    await Teacher.updateMany(
      { bot: botId },
      { $set: { menuDeleteAfterSeconds: menuDeleteAfterSeconds ?? 30 } },
    );

    res.status(200).json({
      success: true,
      message: '批量更新阅后即焚时间成功',
    });
  },
);

// ── Mini App 公开接口 ──────────────────────────────────────────────

/**
 * GET /teachers/public/list
 * 老师列表（带评分排序 + 搜索），供 Mini App 调用
 */
export const getPublicTeachers = handleAsync(
  async (req: Request, res: Response) => {
    const {
      botId,
      period = 'month',
      search,
      excludeBotUserId,
    } = req.query as Record<string, string>;

    if (!botId) {
      res.status(400);
      throw new Error('缺少 botId');
    }

    const query: any = { bot: botId, status: 'approved' };

    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ display_name: re }, { address: re }];
    }

    if (excludeBotUserId) {
      query.botUser = { $ne: excludeBotUserId };
    }

    const teachers = await Teacher.find(query).lean();
    const since = getPeriodStart(period);

    const result = await Promise.all(
      teachers.map(async (t) => {
        const evals = await Evaluation.find({
          teacher: t._id,
          status: 'approved',
          createdAt: { $gte: since },
        }).lean();

        const evaluationCount = evals.length;
        const averageRating =
          evaluationCount > 0
            ? evals.reduce((s, e) => s + calcEvalAvg(e), 0) / evaluationCount
            : 0;

        return {
          ...t,
          images: await signImages(t.images),
          averageRating,
          evaluationCount,
        };
      }),
    );

    result.sort((a, b) => {
      if (b.averageRating !== a.averageRating)
        return b.averageRating - a.averageRating;
      return b.evaluationCount - a.evaluationCount;
    });

    res.json({ success: true, data: result });
  },
);

/**
 * GET /teachers/public/evaluations
 * 某位老师的评价列表，供 Mini App 调用
 */
export const getPublicTeacherEvaluations = handleAsync(
  async (req: Request, res: Response) => {
    const { teacherId, status = 'approved' } = req.query as Record<
      string,
      string
    >;

    if (!teacherId) {
      res.status(400);
      throw new Error('缺少 teacherId');
    }

    const evals = await Evaluation.find({ teacher: teacherId, status })
      .populate('reviewer', 'userName firstName lastName')
      .sort('-createdAt')
      .limit(50)
      .lean();

    const data = await Promise.all(
      evals.map(async (e) => ({
        ...e,
        proof_media: await signImages(e.proof_media || []),
      })),
    );

    res.json({ success: true, data });
  },
);

/**
 * GET /teachers/public/me
 * 当前用户的老师资料（含评分统计），供 Mini App 调用
 */
export const getMyTeacherProfile = handleAsync(
  async (req: Request, res: Response) => {
    const { botId, botUserId } = req.query as Record<string, string>;

    if (!botId || !botUserId) {
      res.status(400);
      throw new Error('缺少 botId 或 botUserId');
    }

    const teacher = await Teacher.findOne({
      bot: botId,
      botUser: botUserId,
    }).lean();

    if (!teacher) {
      res.json({ success: true, data: null });
      return;
    }

    const evals = await Evaluation.find({
      teacher: teacher._id,
      status: 'approved',
    }).lean();
    const evaluationCount = evals.length;
    const averageRating =
      evaluationCount > 0
        ? evals.reduce((s, e) => s + calcEvalAvg(e), 0) / evaluationCount
        : 0;

    res.json({
      success: true,
      data: {
        ...teacher,
        images: await signImages(teacher.images),
        averageRating,
        evaluationCount,
      },
    });
  },
);

/**
 * POST /teachers/public/register
 * 用户提交老师入驻申请或更新资料，供 Mini App 调用
 */
export const registerTeacherPublic = handleAsync(
  async (req: Request, res: Response) => {
    const {
      botId,
      botUserId,
      display_name,
      contactLink,
      address,
      brief,
      isAvailable,
      images = [],
    } = req.body;

    if (!botId || !botUserId) {
      res.status(400);
      throw new Error('缺少 botId 或 botUserId');
    }
    if (!display_name || !contactLink || !address) {
      res.status(400);
      throw new Error('花名、联系方式和地点不能为空');
    }

    const normalizedLink = normalizeContactLink(contactLink);
    if (!normalizedLink) {
      res.status(400);
      throw new Error('联系方式格式不正确，请输入 https://t.me/xxx 或 @xxx');
    }

    const existing = await Teacher.findOne({ bot: botId, botUser: botUserId });
    // 已通过认证的老师更新资料无需重新审核
    const newStatus = existing?.status === 'approved' ? 'approved' : 'pending';

    const teacher = await Teacher.findOneAndUpdate(
      { bot: botId, botUser: botUserId },
      {
        $set: {
          display_name,
          contactLink: normalizedLink,
          address,
          brief: brief || '',
          isAvailable: isAvailable ?? true,
          images,
          status: newStatus,
        },
        $setOnInsert: {
          bot: botId,
          botUser: botUserId,
          videos: [],
          reviews: [],
        },
      },
      { new: true, upsert: true },
    );

    res.status(201).json({ success: true, data: teacher });
  },
);
