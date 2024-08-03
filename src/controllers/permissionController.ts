import { Request, Response } from 'express';
import Permission from '../models/permission';
import handleAsync from '../utils/handleAsync';
import { exclude } from '../utils/handleData';

const getPermissions = handleAsync(async (req: Request, res: Response) => {
  const { name, path, action, current = '1', pageSize = '10' } = req.query;

  const query: any = {};

  if (name) {
    query.name = { $regex: name, $options: 'i' };
  }

  if (path) {
    query.path = path;
  }

  if (action) {
    query.action = action;
  }

  // 执行查询
  const permissions = await Permission.find(query)
    .populate("permissionGroup")
    .sort('-createdAt')  // Sort by creation time in descending order
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Permission.countDocuments(query).exec();

  res.json({
    success: true,
    data: permissions.map(permission => exclude(permission.toObject(), 'permissionGroup')),
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

const addPermission = handleAsync(async (req: Request, res: Response) => {
  const { name, path, action, permissionGroup } = req.body;

  const newPermission = new Permission({
    name,
    path,
    action,
    permissionGroup,
  });

  const savedPermission = await newPermission.save();

  res.json({
    success: true,
    data: savedPermission,
  });
});

const getPermissionById = handleAsync(async (req: Request, res: Response) => {
  const permission = await Permission.findById(req.params.id).populate("permissionGroup");

  if (!permission) {
    res.status(404);
    throw new Error('Permission not found');
  } else {
    res.json({
      success: true,
      data: permission,
    });
  }
});

const updatePermission = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, path, action, permissionGroup } = req.body;

  const updatedPermission = await Permission.findByIdAndUpdate(
    id,
    { name, path, action, permissionGroup },
    { new: true }
  ).populate("permissionGroup");

  if (!updatedPermission) {
    res.status(404);
    throw new Error('Permission not found');
  }

  res.json({
    success: true,
    data: updatedPermission,
  });
});

const deletePermission = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 删除权限
  const permission = await Permission.findByIdAndDelete(id);

  if (!permission) {
    res.status(404);
    throw new Error('Permission not found');
  }

  res.json({
    success: true,
    data: { message: 'Permission deleted successfully' },
  });
});

const deleteMultiplePermissions = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body;

  // 使用 Mongoose 的 deleteMany 方法进行批量删除
  await Permission.deleteMany({
    _id: { $in: ids },
  });

  res.json({
    success: true,
    message: `${ids.length} permissions deleted successfully`,
  });
});

export { deleteMultiplePermissions, updatePermission, deletePermission, getPermissions, addPermission, getPermissionById };
