import { Request, Response } from 'express';
import MaterialCategory, { IMaterialCategory } from '../models/materialCategory';
import handleAsync from '../utils/handleAsync';
import { transformDocumentImages } from '../utils/transformUtils';

const getChildren = async (parentId: string | null): Promise<IMaterialCategory[]> => {
    const children = await MaterialCategory.find({ parent: parentId })
        .populate('parent')  // 填充 parent 字段
        .exec();
    return Promise.all(children.map(async (child) => {
        const childWithChildren = child.toObject();
        childWithChildren.children = await getChildren(child._id);
        return childWithChildren;
    }));
};

const getMaterialCategory = handleAsync(async (req: Request, res: Response) => {
    const { name, image, parent, current = '1', pageSize = '10' } = req.query;

    const query: any = {};

    if (name) {
        query.name = { $regex: name, $options: 'i' };
    }

    if (image) {
        query.image = image;
    }

    if (parent) {
        query.parent = parent;
    } else {
        // 如果没有提供 parent 参数，则查询所有根菜单
        query.parent = null;
    }

    // 执行查询
    const materialCategory = await MaterialCategory.find(query)
        .populate("parent")  // 填充 parent 字段
        .sort('-createdAt')  // Sort by creation time in descending order
        .skip((+current - 1) * +pageSize)
        .limit(+pageSize)
        .exec();


    const total = await MaterialCategory.countDocuments(query).exec();

    // 获取所有材料目录及其子目录
    const materialCategoriesWithChildren = await Promise.all(materialCategory.map(async (materialCategory) => {
        const materialCategoryWithChildren = materialCategory
        materialCategoryWithChildren.children = await getChildren(materialCategory._id);
        return materialCategoryWithChildren;
    }));

    const resovled = await transformDocumentImages(materialCategoriesWithChildren, ['image']);


    res.json({
        success: true,
        data: resovled,
        total,
        current: +current,
        pageSize: +pageSize,
    });
});


const addMaterialCategory = handleAsync(async (req: Request, res: Response) => {
    const { name, image, parent } = req.body;

    const newMaterialCategory = new MaterialCategory({
        name,
        image,
        parent,
    });

    const savedMaterialCategory = await newMaterialCategory.save();

    console.log('obj', savedMaterialCategory)

    res.json({
        success: true,
        data: savedMaterialCategory,
    });
});

const getsavedMaterialCategoryById = handleAsync(async (req: Request, res: Response) => {
    const materialCategory = await MaterialCategory.findById(req.params.id).populate("parent");

    if (!materialCategory) {
        res.status(404);
        throw new Error('MaterialCategory not found');
    } else {
        res.json({
            success: true,
            data: materialCategory,
        });
    }
});

const updateMaterialCategory = handleAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, image, parent } = req.body;

    const updatedMaterialCategory = await MaterialCategory.findByIdAndUpdate(
        id,
        { name, image, parent },
        { new: true }
    ).populate("parent");

    if (!updatedMaterialCategory) {
        res.status(404);
        throw new Error('MaterialCategory not found');
    }

    res.json({
        success: true,
        data: updatedMaterialCategory,
    });
});

const deleteMaterialCategory = handleAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    // 删除材料目录
    const materialCategory = await MaterialCategory.findByIdAndDelete(id);

    if (!materialCategory) {
        res.status(404);
        throw new Error('MaterialCategory not found');
    }

    res.json({
        success: true,
        data: { message: 'MaterialCategory deleted successfully' },
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
        message: `${ids.length} MaterialCategorys deleted successfully`,
    });
});

export { deleteMultipleMaterialCategories, updateMaterialCategory, deleteMaterialCategory, getMaterialCategory, addMaterialCategory, getsavedMaterialCategoryById };
