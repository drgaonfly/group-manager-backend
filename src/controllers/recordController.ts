import { Request, Response } from 'express';
import Record from '../models/record';
import handleAsync from '../utils/handleAsync';
import Topic from '../models/topic';
import { RequestCustom } from '../types/user';

//获取记录管理列表
export const getRecords = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10', user, topic } = req.query;

  const queryConditions: any = {};
  if (user) {
    queryConditions.user = user;
  }
  if (topic) {
    queryConditions.topic = topic;
  }

  // 查询记录
  const records = await Record.find(queryConditions)
    .populate('user')
    .populate('topic')
    .populate('answer')
    .sort('-createdAt') // 按创建时间降序排序
    .skip((+current - 1) * +pageSize) // 跳过前面的记录
    .limit(+pageSize) // 限制返回的记录数
    .exec();

  const total = await Record.countDocuments(queryConditions); // 计算总记录数

  res.json({
    success: true,
    data: records,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 提交新手训练记录
export const submitNewbieTraining = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const topicId = req.params.id; // 从路由参数中获取 topicId
    const { answers } = req.body; // 提交的内容包含 answers
    const userId = req.user._id; // 从 req.user 中获取用户 ID

    // 创建新的记录
    const newRecord = await Record.create({
      user: userId,
      topic: topicId,
      answers,
    });

    res.json({
      success: true,
      data: newRecord,
    });
  },
);

// 获取题目数据
export const getNewbieTraining = handleAsync(
  async (req: RequestCustom, res: Response) => {
    // 查询记录以获取状态
    const records = await Record.find({ user: req.user._id }); // 假设您要根据用户 ID 查询记录

    // 检查状态
    const statuses = records.map((record) => record.status); // 获取所有记录的状态

    // 继续获取题目数据
    const topics = await Topic.find(); // 获取所有题目数据
    res.json({
      success: true,
      data: {
        topics,
        statuses,
      },
    });
  },
);

export const addRecord = handleAsync(async (req: Request, res: Response) => {
  const savedRecord = await Record.create(req.body);
  res.json({
    success: true,
    data: savedRecord,
  });
});

export const getRecordById = handleAsync(
  async (req: Request, res: Response) => {
    const record = await Record.findById(req.params.id).populate('user topic');
    if (!record) {
      res.status(404);
      throw new Error('Record not found');
    }
    res.json({
      success: true,
      data: record,
    });
  },
);

export const updateRecord = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updatedRecord = await Record.findByIdAndUpdate(id, req.body, {
    new: true,
  });
  if (!updatedRecord) {
    res.status(404);
    throw new Error('Record not found');
  }
  res.json({
    success: true,
    data: updatedRecord,
  });
});

export const deleteRecord = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const record = await Record.findByIdAndDelete(id);
  if (!record) {
    res.status(404);
    throw new Error('Record not found');
  }
  res.json({
    success: true,
    data: { message: 'Record deleted successfully' },
  });
});

export const deleteMultipleRecords = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400);
      throw new Error('Invalid request: No IDs provided');
    }

    const result = await Record.deleteMany({ _id: { $in: ids } });
    res.json({
      success: true,
      message: `${result.deletedCount} records deleted successfully`,
      data: { deletedCount: result.deletedCount },
    });
  },
);
