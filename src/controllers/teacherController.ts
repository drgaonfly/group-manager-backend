import { generateSignedUrl } from '../utils/generateSignedUrl';
import { Request, Response } from 'express';
import Evaluation from '../models/evaluation';
import BotUser from '../models/botUser';
import Teacher from '../models/teacher';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';
import { getUserByUsername } from '../utils/getBotUserByUsername';
import Bot from '../models/bot';

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

    const teacher = new Teacher(data);
    const savedTeacher = await teacher.save();
    res.status(201).json({
      success: true,
      data: savedTeacher,
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
