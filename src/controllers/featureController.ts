import { Request, Response } from 'express';
import Feature from '../models/feature';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';

// 构建查询条件
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.title) {
    query.title = { $regex: queryParams.title, $options: 'i' };
  }

  if (queryParams.lang) {
    query.lang = queryParams.lang;
  }

  if (queryParams.type) {
    query.type = queryParams.type;
  }

  return query;
};

// 获取所有特性
const getFeatures = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const features = await Feature.find(query)
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Feature.countDocuments(query).exec();

  res.json({
    success: true,
    data: features,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 添加特性
const addFeature = handleAsync(async (req: RequestCustom, res: Response) => {
  const newFeature = new Feature({
    ...req.body,
    image: req.body.image, // 确保路径格式正确
  });

  const savedFeature = await newFeature.save();

  res.json({
    success: true,
    data: savedFeature,
  });
});

// 根据ID获取特性
const getFeatureById = handleAsync(async (req: Request, res: Response) => {
  const feature = await Feature.findById(req.params.id);

  if (!feature) {
    res.status(404);
    throw new Error('特性不存在');
  }

  res.json({
    success: true,
    data: {
      ...feature,
    },
  });
});

// 更新特性
const updateFeature = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { image, ...otherFields } = req.body;

  const feature = await Feature.findById(id);
  if (!feature) {
    res.status(404);
    throw new Error('特性不存在');
  }

  // 更新字段
  const updates = {
    ...(image && !image.startsWith('http') && { image }),
    ...otherFields,
  };

  const updatedFeature = await Feature.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  res.json({
    success: true,
    data: updatedFeature,
  });
});

// 删除特性
const deleteFeature = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 删除特性
  const feature = await Feature.findByIdAndDelete(id);

  if (!feature) {
    res.status(404);
    throw new Error('特性不存在');
  }

  res.json({
    success: true,
    data: { message: 'feature deleted successfully' },
  });
});

// 批量删除特性
const deleteMultipleFeatures = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    // 使用 Mongoose 的 deleteMany 方法进行批量删除
    await Feature.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} features deleted successfully`,
    });
  },
);

export {
  getFeatures,
  addFeature,
  getFeatureById,
  updateFeature,
  deleteFeature,
  deleteMultipleFeatures,
};
