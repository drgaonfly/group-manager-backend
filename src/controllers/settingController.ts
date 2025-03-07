import { Request, Response } from 'express';
import Setting from '../models/setting'; // 假设有设置模型
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';

// 构建查询条件
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  // 通过 key 查询
  if (queryParams.key) {
    query.key = queryParams.key;
  }

  // 通过可见性查询
  if (queryParams.isVisible !== undefined) {
    query.isVisible = queryParams.isVisible === 'true'; // 转换为布尔值
  }

  return query;
};

// 获取设置列表
const getSettings = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const settings = await Setting.find(query)
    .sort('-createdAt') // 按创建时间排序
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .lean()
    .exec();

  const total = await Setting.countDocuments(query).exec();

  res.json({
    success: true,
    data: settings,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 创建新设置
const addSetting = handleAsync(async (req: Request, res: Response) => {
  const newId = await IdGen.next(Setting, 'id', 6);

  const setting = await Setting.create({
    ...req.body,
    id: newId,
  });

  res.status(201).json({
    success: true,
    data: setting,
  });
});

// 获取单个设置
const getSettingById = handleAsync(async (req: Request, res: Response) => {
  const setting = await Setting.findById(req.params.id);

  if (!setting) {
    res.status(404);
    throw new Error('设置项不存在');
  }

  res.json({
    success: true,
    data: setting,
  });
});

// 更新设置
const updateSetting = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const setting = await Setting.findById(id);
  if (!setting) {
    res.status(404);
    throw new Error('设置项不存在');
  }

  const updatedSetting = await Setting.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true, runValidators: true },
  );

  res.json({
    success: true,
    data: updatedSetting,
  });
});

// 删除设置
const deleteSetting = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const setting = await Setting.findByIdAndDelete(id);

  if (!setting) {
    res.status(404);
    throw new Error('设置项不存在');
  }

  res.json({
    success: true,
    data: { message: '设置项删除成功' },
  });
});

// 批量删除设置
const deleteMultipleSettings = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Setting.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `成功删除 ${ids.length} 条设置项`,
    });
  },
);

// 根据 key 获取设置
const getSettingByKey = handleAsync(async (req: Request, res: Response) => {
  const { key } = req.query;

  const setting = await Setting.findOne({ key });

  if (!setting) {
    res.status(404);
    throw new Error('未找到对应的设置项');
  }

  res.json({
    success: true,
    data: setting,
  });
});

export {
  getSettings,
  addSetting,
  getSettingById,
  updateSetting,
  deleteSetting,
  deleteMultipleSettings,
  getSettingByKey,
};
