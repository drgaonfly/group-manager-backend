import { Request, Response } from 'express';
import Menu, { IMenu } from '../models/menu';
import checkMenu from '../utils/checkMenu';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from '../types/user';
import Permission from '../models/permission';

const getChildren = async (parentId: string | null): Promise<IMenu[]> => {
  const children = await Menu.find({ parent: parentId })
    .populate('permission')
    .populate('parent') // 填充 parent 字段
    .exec();
  return Promise.all(
    children.map(async (child) => {
      const childWithChildren = child.toObject();
      childWithChildren.children = await getChildren(child._id.toString());
      return childWithChildren;
    }),
  );
};

// @desc Get permission menus
// @route GET /api/menus/fetch
// @access Private
const fetchMenus = handleAsync(async (req: RequestCustom, res: Response) => {
  const query = buildQuery(req.query);

  const menus = await Menu.find({ ...query, isOnline: true })
    .populate('parent')
    .populate('permission')
    .sort('weight');

  const menusWithChildren = await Promise.all(
    menus.map(async (menu) => {
      const menuWithChildren = menu.toObject();
      menuWithChildren.children = await getChildren(menu._id.toString());
      return menuWithChildren;
    }),
  );

  res.json({
    success: true,
    data: checkMenu(menusWithChildren, req.user),
  });
});

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.name) {
    query.name = { $regex: queryParams.name, $options: 'i' };
  }

  if (queryParams.path) {
    query.path = { $regex: queryParams.path, $options: 'i' };
  }

  if (queryParams.parent) {
    query.parent = queryParams.parent;
  } else {
    query.parent = null;
  }

  // Add recursive children query
  if (queryParams.children) {
    query.children = [
      { 'children.name': { $regex: queryParams.children, $options: 'i' } },
      // Add conditions for other child properties if needed
    ];
  }

  return query;
};

const getMenus = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  // 执行查询
  const menus = await Menu.find(query)
    .populate('permission')
    .populate('parent') // 填充 parent 字段
    .sort('-createdAt') // Sort by creation time in descending order
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Menu.countDocuments(query).exec();

  // 获取所有菜单及其子菜单
  const menusWithChildren = await Promise.all(
    menus.map(async (menu) => {
      const menuWithChildren = menu.toObject();
      menuWithChildren.children = await getChildren(menu._id.toString());
      return menuWithChildren;
    }),
  );

  res.json({
    success: true,
    data: menusWithChildren,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

const addMenu = handleAsync(async (req: Request, res: Response) => {
  const { permission, ...menuData } = req.body;

  const existingPermission = await Permission.findById(permission);

  if (!existingPermission) {
    res.status(404);
    throw new Error('Permission not found');
  }

  const newMenu = new Menu({
    ...menuData,
    permission,
  });

  const savedMenu = await newMenu.save();

  res.json({
    success: true,
    data: savedMenu,
  });
});

const getMenuById = handleAsync(async (req: Request, res: Response) => {
  const menu = await Menu.findById(req.params.id)
    .populate('permission')
    .populate('parent');

  if (!menu) {
    res.status(404);
    throw new Error('Menu not found');
  } else {
    res.json({
      success: true,
      data: menu,
    });
  }
});

const updateMenu = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedMenu = await Menu.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  );

  if (!updatedMenu) {
    res.status(404);
    throw new Error('Menu not found');
  }

  res.json({
    success: true,
    data: updatedMenu,
  });
});

const deleteMenu = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 删除菜单
  const menu = await Menu.findByIdAndDelete(id);

  if (!menu) {
    res.status(404);
    throw new Error('Menu not found');
  }

  res.json({
    success: true,
    data: { message: 'Menu deleted successfully' },
  });
});

const deleteMultipleMenus = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body;

  // 使用 Mongoose 的 deleteMany 方法进行批量删除
  await Menu.deleteMany({
    _id: { $in: ids },
  });

  res.json({
    success: true,
    message: `${ids.length} menus deleted successfully`,
  });
});

export {
  deleteMultipleMenus,
  updateMenu,
  deleteMenu,
  getMenus,
  addMenu,
  getMenuById,
  fetchMenus,
};
