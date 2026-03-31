import { Request, Response } from 'express';
import Teacher from '../models/teacher';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';

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

    const total = await Teacher.countDocuments(query);

    res.status(200).json({
      success: true,
      data: teachers,
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
    const teacher = new Teacher({
      ...req.body,
      proxy: req.user._id,
    });

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

    res.status(200).json({
      success: true,
      data: { message: '老师删除成功' },
    });
  },
);

/**
 * 批量删除老师
 */
export const deleteMultipleTeachers = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400);
      throw new Error('请提供要删除的老师 ID 列表');
    }

    await Teacher.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      success: true,
      message: `成功删除 ${ids.length} 个老师`,
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
