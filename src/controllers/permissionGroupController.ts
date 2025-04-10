import { Request, Response } from 'express';
import PermissionGroup from '../models/permissionGroup';
import handleAsync from '../utils/handleAsync';
import Permission from '../models/permission';

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.name) {
    query.name = { $regex: queryParams.name, $options: 'i' };
  }

  if (queryParams.parent) {
    query.parent = queryParams.parent;
  } else {
    query.parent = null;
  }

  return query;
};

const getChildren = async (parentId: string | null): Promise<any[]> => {
  const children = await PermissionGroup.find({ parent: parentId })
    .populate('parent')
    .populate('permissions')
    .exec();
  return Promise.all(
    children.map(async (child) => ({
      ...child.toObject(),
      children: await getChildren(child._id.toString()),
    })),
  );
};

// 获取权限组列表
const getPermissionGroups = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  // 执行查询
  const permissionGroups = await PermissionGroup.find(query)
    .populate('parent') // Assuming you want to populate parent
    .populate('permissions')
    .sort('-createdAt') // Sort by creation time in descending order
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await PermissionGroup.countDocuments(query).exec();

  const getPermissionGroupsWithChildren = async (
    permissionGroups: any[],
  ): Promise<any[]> => {
    return Promise.all(
      permissionGroups.map(async (permissionGroup) => ({
        ...permissionGroup.toObject(),
        children: await getChildren(permissionGroup._id),
      })),
    );
  };

  const permissionGroupsWithChildren =
    await getPermissionGroupsWithChildren(permissionGroups);

  res.json({
    success: true,
    data: permissionGroupsWithChildren,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

const getPermissionGroupsList = handleAsync(
  async (req: Request, res: Response) => {
    // 获取所有根权限组
    const permissionGroups = await PermissionGroup.find({ parent: null })
      .sort('-createdAt') // 按创建时间降序排序
      .exec();

    const total = await PermissionGroup.countDocuments({ parent: null }).exec();

    const getChildren = async (parentId: string | null): Promise<any[]> => {
      const children = await PermissionGroup.find({ parent: parentId })
        .populate('parent')
        .exec();
      return Promise.all(
        children.map(async (child) => {
          const childObj = child.toObject();
          const permissions = await Permission.find({
            permissionGroup: child._id,
          }).exec();
          return {
            ...childObj,
            children:
              permissions.length > 0
                ? permissions
                : await getChildren(child._id.toString()),
          };
        }),
      );
    };

    const getPermissionGroupsWithChildren = async (
      permissionGroups: any[],
    ): Promise<any[]> => {
      return Promise.all(
        permissionGroups.map(async (permissionGroup) => {
          const permissionGroupObj = permissionGroup.toObject();
          const permissions = await Permission.find({
            permissionGroup: permissionGroup._id,
          }).exec();
          return {
            ...permissionGroupObj,
            children:
              permissions.length > 0
                ? permissions
                : await getChildren(permissionGroup._id.toString()),
          };
        }),
      );
    };

    const permissionGroupsWithChildren =
      await getPermissionGroupsWithChildren(permissionGroups);

    res.json({
      success: true,
      data: permissionGroupsWithChildren,
      total,
    });
  },
);

// 添加权限组
const addPermissionGroup = handleAsync(async (req: Request, res: Response) => {
  const newPermissionGroup = new PermissionGroup({
    ...req.body,
  });

  const savedPermissionGroup = await newPermissionGroup.save();

  res.json({
    success: true,
    data: savedPermissionGroup,
  });
});

// 获取单个权限组
const getPermissionGroupById = handleAsync(
  async (req: Request, res: Response) => {
    const permissionGroup = await PermissionGroup.findById(
      req.params.id,
    ).populate('parent');

    if (!permissionGroup) {
      res.status(404);
      throw new Error('PermissionGroup not found');
    } else {
      res.json({
        success: true,
        data: permissionGroup,
      });
    }
  },
);

// 更新权限组
const updatePermissionGroup = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const updatedPermissionGroup = await PermissionGroup.findByIdAndUpdate(
      id,
      { ...req.body },
      { new: true },
    ).populate('parent');

    if (!updatedPermissionGroup) {
      res.status(404);
      throw new Error('PermissionGroup not found');
    }

    res.json({
      success: true,
      data: updatedPermissionGroup,
    });
  },
);

// 删除权限组
const deletePermissionGroup = handleAsync(
  async (req: Request, res: Response) => {
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
  },
);

// 批量删除权限组
const deleteMultiplePermissionGroups = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    // 使用 Mongoose 的 deleteMany 方法进行批量删除
    await PermissionGroup.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} permission groups deleted successfully`,
    });
  },
);

export {
  deleteMultiplePermissionGroups,
  updatePermissionGroup,
  deletePermissionGroup,
  getPermissionGroups,
  addPermissionGroup,
  getPermissionGroupById,
  getPermissionGroupsList,
};
