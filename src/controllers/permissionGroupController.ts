import { Request, Response } from 'express';
import PermissionGroup from '../models/permissionGroup';
import handleAsync from '../utils/handleAsync';
import Permission from '../models/permission';

// 获取权限组列表
// 获取权限组列表
const getPermissionGroups = handleAsync(async (req: Request, res: Response) => {
  const { name, parent, current = '1', pageSize = '10' } = req.query;
  const query: any = {};

  if (name) {
    query.name = { $regex: name, $options: 'i' };
  }

  if (parent) {
    query.parent = parent;
  } else {
    // 如果没有提供 parent 参数，则查询所有根节点
    query.parent = null;
  }

  // 执行查询
  const permissionGroups = await PermissionGroup.find(query)
    .populate("parent")      // Assuming you want to populate parent
    .sort('-createdAt')      // Sort by creation time in descending order
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await PermissionGroup.countDocuments(query).exec();

  // 递归函数来获取子权限组
  const getChildren = async (parentId: string | null) => {
    const children = await PermissionGroup.find({ parent: parentId }).populate('parent').exec();
    return Promise.all(children.map(async (child) => {
      const childWithChildren = child.toObject();
      childWithChildren.children = await getChildren(child._id);
      return childWithChildren;
    }));
  };

  // 获取所有权限组及其子权限组
  const permissionGroupsWithChildren = await Promise.all(permissionGroups.map(async (permissionGroup) => {
    const groupWithChildren = permissionGroup.toObject();
    groupWithChildren.children = await getChildren(permissionGroup._id);
    return groupWithChildren;
  }));

  res.json({
    success: true,
    data: permissionGroupsWithChildren,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});


const getPermissionGroupsList = handleAsync(async (req: Request, res: Response) => {

  // 获取所有根权限组
  const rootGroups = await PermissionGroup.find({ parent: null })
    .sort('-createdAt')      // 按创建时间降序排序
    .exec();

  const total = await PermissionGroup.countDocuments({ parent: null }).exec();

  // 递归函数来获取子权限组
  const getChildren = async (parentId: string | null) => {
    const children = await PermissionGroup.find({ parent: parentId }).exec();
    return Promise.all(children.map(async (child) => {
      const childWithChildren = child.toObject();
      
      const permissions = await Permission.find({ PermissionGroup: child._id }).exec();
      console.log("permissions", permissions)
      if (permissions.length > 0) {
        childWithChildren.children = permissions;
      } else {
        childWithChildren.children = await getChildren(child._id);
      }

      return childWithChildren;
    }));
  };

  // 获取所有根权限组及其子权限组或权限
  const permissionGroupsWithChildrenOrPermissions = await Promise.all(rootGroups.map(async (rootGroup) => {
    const groupWithChildren = rootGroup.toObject();
 
    groupWithChildren.children = await getChildren(rootGroup._id);

    return groupWithChildren;
  }));

  res.json({
    success: true,
    data: permissionGroupsWithChildrenOrPermissions,
    total
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

export { deleteMultiplePermissionGroups, updatePermissionGroup, deletePermissionGroup, getPermissionGroups, addPermissionGroup, getPermissionGroupById, getPermissionGroupsList };
