// materialCategoryController.ts
import { Request, Response } from 'express';
import MaterialCategory, {
  IMaterialCategory,
} from '../models/materialCategory';
import handleAsync from '../utils/handleAsync';
import { transformDocumentImage } from '../utils/transformUtils';

const getChildren = async (
  parentId: string | null,
): Promise<IMaterialCategory[]> => {
  const children = await MaterialCategory.find({ parent: parentId })
    .populate('parent')
    .exec();

  return Promise.all(
    children.map(async (child) => {
      const childWithChildren = child.toObject();
      childWithChildren.children = await getChildren(child._id);
      return await transformDocumentImage(childWithChildren, 'image');
    }),
  );
};

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

  if (queryParams.image) {
    query.image = queryParams.image;
  }

  return query;
};

const getMaterialCategories = handleAsync(
  async (req: Request, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = buildQuery(req.query);

    // 执行查询
    const categories = await MaterialCategory.find(query)
      .populate('parent') // 填充 parent 字段
      .sort('-createdAt') // Sort by creation time in descending order
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    const total = await MaterialCategory.countDocuments(query).exec();

    // 获取所有分类及其子分类，并处理 image 字段
    const categoriesWithChildren = await Promise.all(
      categories.map(async (category) => {
        const children = await getChildren(category._id);
        const categoryWithChildren = { ...category.toObject(), children };
        return await transformDocumentImage(categoryWithChildren, 'image');
      }),
    );

    res.json({
      success: true,
      data: categoriesWithChildren,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

const addMaterialCategory = handleAsync(async (req: Request, res: Response) => {
  const { image, ...rest } = req.body;

  const newCategory = new MaterialCategory({
    ...rest,
    image, // 使用 image 字段初始化 image 属性
  });

  console.log('newCategory', newCategory);

  const savedCategory = await newCategory.save();

  console.log('savedCategory', savedCategory);

  res.json({
    success: true,
    data: savedCategory,
  });
});

const getMaterialCategoryById = handleAsync(
  async (req: Request, res: Response) => {
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
  },
);

const updateMaterialCategory = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const updateData = req.body; // 从请求体中获取更新的数据

    console.log('Update data:', updateData);

    const updatedCategory = await MaterialCategory.findByIdAndUpdate(
      id,
      updateData, // 更新字段和新值
      { new: true }, // 选项：返回更新后的文档
    );

    if (!updatedCategory) {
      res.status(404);
      throw new Error('Material Category not found');
    }

    res.json({
      success: true,
      data: updatedCategory,
    });
  },
);

const deleteMaterialCategory = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    console.log(`Attempting to delete MaterialCategory with ID: ${id}`);

    // 删除分类
    const category = await MaterialCategory.findByIdAndDelete(id);

    if (!category) {
      console.error(
        `MaterialCategory with ID ${id} was not found in the database.`,
      );
      res.status(404);
      throw new Error('Material Category not found');
    }

    console.log(`Deleted MaterialCategory:`, category);

    res.json({
      success: true,
      data: { message: 'Material Category deleted successfully' },
    });
  },
);

const deleteMultipleMaterialCategories = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    // 使用 Mongoose 的 deleteMany 方法进行批量删除
    await MaterialCategory.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} material categories deleted successfully`,
    });
  },
);

export {
  deleteMultipleMaterialCategories,
  updateMaterialCategory,
  deleteMaterialCategory,
  getMaterialCategories,
  addMaterialCategory,
  getMaterialCategoryById,
};
