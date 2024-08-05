// dataPermissionController.ts
import { Request, Response } from 'express';
import DataPermission, { IDataPermission } from '../models/dataPermission';
import handleAsync from '../utils/handleAsync';

// 获取所有数据权限
const getDataPermissions = handleAsync(async (req: Request, res: Response) => {
  const { name, path, current = '1', pageSize = '10' } = req.query;

  const query: any = {};

  if (name) {
    query.name = { $regex: name, $options: 'i' };
  }

  if (path) {
    query.path = path;
  }

  // 执行查询
  const dataPermissions = await DataPermission.find(query)
    .sort('-createdAt')  // Sort by creation time in descending order
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await DataPermission.countDocuments(query).exec();

  res.json({
    success: true,
    data: dataPermissions,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 添加数据权限
const addDataPermission = handleAsync(async (req: Request, res: Response) => {
  const { name, path } = req.body;

  const newDataPermission = new DataPermission({
    name,
    path,
  });

  const savedDataPermission = await newDataPermission.save();

  res.json({
    success: true,
    data: savedDataPermission,
  });
});

// 根据ID获取数据权限
const getDataPermissionById = handleAsync(async (req: Request, res: Response) => {
  const dataPermission = await DataPermission.findById(req.params.id);

  if (!dataPermission) {
    res.status(404);
    throw new Error('Data permission not found');
  } else {
    res.json({
      success: true,
      data: dataPermission,
    });
  }
});

// 更新数据权限
const updateDataPermission = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, path } = req.body;

  const updatedDataPermission = await DataPermission.findByIdAndUpdate(
    id,
    { name, path },
    { new: true }
  );

  if (!updatedDataPermission) {
    res.status(404);
    throw new Error('Data permission not found');
  }

  res.json({
    success: true,
    data: updatedDataPermission,
  });
});

// 删除数据权限
const deleteDataPermission = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 删除数据权限
  const dataPermission = await DataPermission.findByIdAndDelete(id);

  if (!dataPermission) {
    res.status(404);
    throw new Error('Data permission not found');
  }

  res.json({
    success: true,
    data: { message: 'Data permission deleted successfully' },
  });
});

// 批量删除数据权限
const deleteMultipleDataPermissions = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body;

  // 使用 Mongoose 的 deleteMany 方法进行批量删除
  await DataPermission.deleteMany({
    _id: { $in: ids },
  });

  res.json({
    success: true,
    message: `${ids.length} data permissions deleted successfully`,
  });
});

export { 
  getDataPermissions, 
  addDataPermission, 
  getDataPermissionById, 
  updateDataPermission, 
  deleteDataPermission, 
  deleteMultipleDataPermissions 
};
