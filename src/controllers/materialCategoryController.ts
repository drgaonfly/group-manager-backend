// materialCategoryController.ts
import { Request, Response } from 'express';
import MaterialCategory, { IMaterialCategory } from '../models/materialCategory';
import handleAsync from '../utils/handleAsync';
import { transformDocumentImages } from '../utils/transformUtils'; // 确保路径是正确的

const getChildren = async (parentId: string | null): Promise<IMaterialCategory[]> => {
  const children = await MaterialCategory.find({ parent: parentId })
    .populate('parent')
    .exec();

  return Promise.all(children.map(async (child) => {
    const childWithChildren = child.toObject();
    childWithChildren.children = await getChildren(child._id);
    return childWithChildren;
  }));
};

const getMaterialCategories = handleAsync(async (req: Request, res: Response) => {
  const { name, parent, current = '1', pageSize = '10' } = req.query;

  const query: any = {};

  if (name) {
    query.name = { $regex: name, $options: 'i' };
  }

  if (parent) {
    query.parent = parent;
  } else {
    // 如果没有提供 parent 参数，则查询所有根分类
    query.parent = null;
  }

  // 执行查询
  const categories = await MaterialCategory.find(query)
    .populate('parent')  // 填充 children 字段
    .sort('-createdAt')  // Sort by creation time in descending order
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();


  const total = await MaterialCategory.countDocuments(query).exec();

  console.log('categories',categories)

  // 获取所有分类及其子分类
  const categoriesWithChildren = await Promise.all(categories.map(async (category) => {
    const categoryWithChildren = category.toObject();
    categoryWithChildren.children = await getChildren(category._id);
    console.log('categoryWithChildren',categoryWithChildren);
    return categoryWithChildren;
  }));

  res.json({
    success: true,
    data: categoriesWithChildren,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

const addMaterialCategory = handleAsync(async (req: Request, res: Response) => {
  const { name, parent } = req.body;

  const newCategory = new MaterialCategory({
    name,
    parent,
  });

  const savedCategory = await newCategory.save();

  res.json({
    success: true,
    data: savedCategory,
  });
});

const getMaterialCategoryById = handleAsync(async (req: Request, res: Response) => {
  const category = await MaterialCategory.findById(req.params.id);

  if (!category) {
    res.status(404);
    throw new Error('Material Category not found');
  } else {
    res.json({
      success: true,
      data: category,
    });
  }
});

const updateMaterialCategory = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, parent } = req.body;

  const updatedCategory = await MaterialCategory.findByIdAndUpdate(
    id,
    { name, parent },
    { new: true }
  ).populate('children');

  if (!updatedCategory) {
    res.status(404);
    throw new Error('Material Category not found');
  }

  res.json({
    success: true,
    data: updatedCategory,
  });
});

const deleteMaterialCategory = handleAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
  
    console.log(`Attempting to delete MaterialCategory with ID: ${id}`);
  
    // 删除分类
    const category = await MaterialCategory.findByIdAndDelete(id);
  
    if (!category) {
      console.error(`MaterialCategory with ID ${id} was not found in the database.`);
      res.status(404);
      throw new Error('Material Category not found');
    }
  
    console.log(`Deleted MaterialCategory:`, category);
  
    res.json({
      success: true,
      data: { message: 'Material Category deleted successfully' },
    });
  });

const deleteMultipleMaterialCategories = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body;

  // 使用 Mongoose 的 deleteMany 方法进行批量删除
  await MaterialCategory.deleteMany({
    _id: { $in: ids },
  });

  res.json({
    success: true,
    message: `${ids.length} material categories deleted successfully`,
  });
});

export { deleteMultipleMaterialCategories, updateMaterialCategory, deleteMaterialCategory, getMaterialCategories, addMaterialCategory, getMaterialCategoryById };