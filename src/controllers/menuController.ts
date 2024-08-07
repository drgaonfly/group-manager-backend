import { Request, Response } from 'express';
import Menu, { IMenu } from '../models/menu';
import handleAsync from '../utils/handleAsync';

const getChildren = async (parentId: string | null): Promise<IMenu[]> => {
  const children = await Menu.find({ parent: parentId })
    .populate('permission')
    .populate('parent')  // 填充 parent 字段
    .exec();
  return Promise.all(children.map(async (child) => {
    const childWithChildren = child.toObject();
    childWithChildren.children = await getChildren(child._id);
    return childWithChildren;
  }));
};



const getMenus = handleAsync(async (req: Request, res: Response) => {
  const { name, path, parent, current = '1', pageSize = '10' } = req.query;

  const query: any = {};

  if (name) {
    query.name = { $regex: name, $options: 'i' };
  }

  if (path) {
    query.path = path;
  }

  if (parent) {
    query.parent = parent;
  } else {
    // 如果没有提供 parent 参数，则查询所有根菜单
    query.parent = null;
  }

  // 执行查询
  const menus = await Menu.find(query)
    .populate("permission")
    .populate("parent")  // 填充 parent 字段
    .sort('-createdAt')  // Sort by creation time in descending order
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Menu.countDocuments(query).exec();

  // 获取所有菜单及其子菜单
  const menusWithChildren = await Promise.all(menus.map(async (menu) => {
    const menuWithChildren = menu.toObject();
    menuWithChildren.children = await getChildren(menu._id);
    return menuWithChildren;
  }));

  res.json({
    success: true,
    data: menusWithChildren,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});


const addMenu = handleAsync(async (req: Request, res: Response) => {
  const { name, path, parent, permission } = req.body;

  const newMenu = new Menu({
    name,
    path,
    parent,
    permission,
  });

  const savedMenu = await newMenu.save();

  res.json({
    success: true,
    data: savedMenu,
  });
});

const getMenuById = handleAsync(async (req: Request, res: Response) => {
  const menu = await Menu.findById(req.params.id).populate("permission").populate("parent");

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
  const { name, path, parent, permission } = req.body;

  const updatedMenu = await Menu.findByIdAndUpdate(
    id,
    { name, path, parent, permission },
    { new: true }
  ).populate("permission").populate("parent");

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

export { deleteMultipleMenus, updateMenu, deleteMenu, getMenus, addMenu, getMenuById };
