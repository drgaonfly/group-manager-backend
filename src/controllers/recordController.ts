import { Request, Response } from 'express';
import Record from '../models/record';
import handleAsync from '../utils/handleAsync';
import { exclude } from '../utils/handleData';

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
  let records = await Record.find(queryConditions)
    .populate('user topic')
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

export const addRecord = handleAsync(async (req: Request, res: Response) => {
  const { user, topic, answer } = req.body;
  const newRecord = new Record({ user, topic, answer });
  const savedRecord = await newRecord.save();
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
