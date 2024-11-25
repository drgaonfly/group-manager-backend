import { Request, Response } from 'express';
import Role from '../models/role';
import handleAsync from '../utils/handleAsync';

// Build query based on query parameters
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.name) {
    query.name = { $regex: queryParams.name, $options: 'i' };
  }

  return query;
};

// 获取所有角色
const getRoles = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const roles = await Role.find(query)
    .populate('permissions')
    .populate('dataPermissions')
    .sort('-createdAt') // Sort by creation time in descending order
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  res.json({
    success: true,
    data: roles,
  });
});

// 根据 ID 获取角色
const getRoleById = handleAsync(async (req: Request, res: Response) => {
  const role = await Role.findById(req.params.id).exec();

  if (!role) {
    res.status(404);
    throw new Error('Role not found');
  }

  res.json({
    success: true,
    data: role,
  });
});

// 添加新角色
const addRole = handleAsync(async (req: Request, res: Response) => {
  const newRole = new Role({
    ...req.body,
  });

  const savedRole = await newRole.save();

  res.json({
    success: true,
    data: savedRole,
  });
});

// 更新角色
const updateRole = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedRole = await Role.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  ).exec();

  if (!updatedRole) {
    res.status(404);
    throw new Error('Role not found');
  }

  res.json({
    success: true,
    data: updatedRole,
  });
});

// 删除角色
const deleteRole = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const role = await Role.findByIdAndDelete(id).exec();

  if (!role) {
    res.status(404);
    throw new Error('Role not found');
  }

  res.json({
    success: true,
    data: { message: 'Role deleted successfully' },
  });
});

// 批量删除角色
const deleteMultipleRoles = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body;

  await Role.deleteMany({
    _id: { $in: ids },
  }).exec();

  res.json({
    success: true,
    message: `${ids.length} roles deleted successfully`,
  });
});

export {
  getRoles,
  getRoleById,
  addRole,
  updateRole,
  deleteRole,
  deleteMultipleRoles,
};
