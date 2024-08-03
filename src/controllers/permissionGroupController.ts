import { Request, Response } from 'express';
import PermissionGroup from '../models/permission-group';
import handleAsync from '../utils/handleAsync';
import { exclude } from '../utils/handleData';

// 获取权限组列表
const getPermissionGroups = handleAsync(async (req: Request, res: Response) => {
  const { name, parent, current = '1', pageSize = '10' } = req.query;

  const query: any = {};

  if (name) {
    query.name = { $regex: name, $options: 'i' };
  }

  if (parent) {
    query.parent = parent;
  }

  // 执行查询
  const permissionGroups = await PermissionGroup.find(query)
    .populate("parent")       // Assuming you want to populate parent
    .sort('-createdAt')      // Sort by creation time in descending order
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await PermissionGroup.countDocuments(query).exec();

  res.json({
    success: true,
    data: permissionGroups.map(permissionGroup => exclude(permissionGroup.toObject())),
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 添加权限组
const addPermissionGroup = handleAsync(async (req: Request, res: Response) => {
  const { name, parent } = req.body;

  const newPermissionGroup = new PermissionGroup({
    name,
    parent,
  });

  const savedPermissionGroup = await newPermissionGroup.save();

  res.json({
    success: true,
    data: savedPermissionGroup,
  });
});

// 获取单个权限组
const getPermissionGroupById = handleAsync(async (req: Request, res: Response) => {
  const permissionGroup = await PermissionGroup.findById(req.params.id)
    .populate("parent");

  if (!permissionGroup) {
    res.status(404);
    throw new Error('PermissionGroup not found');
  } else {
    res.json({
      success: true,
      data: permissionGroup,
    });
  }
});

// 更新权限组
const updatePermissionGroup = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, parent } = req.body;

  const updatedPermissionGroup = await PermissionGroup.findByIdAndUpdate(
    id,
    { name, parent },
    { new: true }
  ).populate("parent");

  if (!updatedPermissionGroup) {
    res.status(404);
    throw new Error('PermissionGroup not found');
  }

  res.json({
    success: true,
    data: updatedPermissionGroup,
  });
});

// 删除权限组
const deletePermissionGroup = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 删除权限组
  const permissionGroup = await PermissionGroup.findByIdAndDelete(id);

  if (!permissionGroup) {
    res.status(404);
    throw new Error('PermissionGroup not found');
  }

  res.json({
    success: true,
    data: { message: 'PermissionGroup deleted successfully' },
  });
});

// 批量删除权限组
const deleteMultiplePermissionGroups = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body;

  // 使用 Mongoose 的 deleteMany 方法进行批量删除
  await PermissionGroup.deleteMany({
    _id: { $in: ids },
  });

  res.json({
    success: true,
    message: `${ids.length} permission groups deleted successfully`,
  });
});

export { deleteMultiplePermissionGroups, updatePermissionGroup, deletePermissionGroup, getPermissionGroups, addPermissionGroup, getPermissionGroupById };
