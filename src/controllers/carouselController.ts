import { Request, Response } from 'express';
import Carousel from '../models/carousel';
import handleAsync from '../utils/handleAsync';
import { CustomRequest } from './uploadController';
import {
  transformDocumentImage,
  transformDocumentImages,
} from '../utils/transformUtils';
import probe from 'probe-image-size';

// dataPermissionController.ts
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.createAt) {
    query.createAt = queryParams.createAt;
  }

  return query;
};

// 获取所有轮播图
const getCarousels = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const carousels = await Carousel.find(query)
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  // 保留 transformDocumentImages 的处理逻辑
  const processedCarousels = await transformDocumentImages(carousels, [
    'image',
  ]);

  // 遍历处理每个轮播图的图片大小和类型
  for (const carousel of processedCarousels) {
    try {
      const result = await probe(carousel.image); // 获取图片尺寸和类型

      carousel.size = `${result.width}x${result.height}`; // 添加图片尺寸
      carousel.type = result.type; // 添加图片类型 (如 'jpeg', 'png' 等)
      carousel.path = carousel.image; // 添加图片路径
    } catch (err) {
      console.error(`Error fetching details for image: ${carousel.image}`, err);
      carousel.size = 'unknown'; // 如果获取失败，设置为 unknown
      carousel.type = 'unknown'; // 图片类型也设置为 unknown
    }
  }

  const total = await Carousel.countDocuments(query).exec();

  res.json({
    success: true,
    data: processedCarousels,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});
// 添加轮播图
const addCarousel = handleAsync(async (req: CustomRequest, res: Response) => {
  const newcarousel = new Carousel({
    ...req.body,
    image: req.body.image, // 确保路径格式正确
  });

  const savedcarousel = await newcarousel.save();

  res.json({
    success: true,
    data: savedcarousel,
  });
});

// 根据ID获取轮播图
const getCarouselById = handleAsync(async (req: Request, res: Response) => {
  const carousel = await Carousel.findById(req.params.id);

  if (!carousel) {
    res.status(404);
    throw new Error('轮播图不存在');
  }

  // 处理图片路径
  const processedcarousel = await transformDocumentImage(carousel, ['image']);

  res.json({
    success: true,
    data: {
      ...processedcarousel,
    },
  });
});

// 更新答案
const updateCarousel = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { image, ...otherFields } = req.body;

  const carousel = await Carousel.findById(id);
  if (!carousel) {
    res.status(404);
    throw new Error('轮播图不存在');
  }

  // 更新字段
  const updates = {
    ...(image && !image.startsWith('http') && { image }),
    ...otherFields,
  };

  const updatedCarousel = await Carousel.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  // 处理图片路径
  const processedCarousel = await transformDocumentImage(updatedCarousel, [
    'image',
  ]);

  res.json({
    success: true,
    data: processedCarousel,
  });
});

// 删除轮播图
const deleteCarousel = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 删除轮播图
  const carousel = await Carousel.findByIdAndDelete(id);

  if (!carousel) {
    res.status(404);
    throw new Error('轮播图不存在');
  }

  res.json({
    success: true,
    data: { message: 'carousel deleted successfully' },
  });
});

// 批量删除轮播图1
const deleteMultipleCarousels = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    // 使用 Mongoose 的 deleteMany 方法进行批量删除
    await Carousel.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} carousels deleted successfully`,
    });
  },
);

export {
  getCarousels,
  addCarousel,
  getCarouselById,
  updateCarousel,
  deleteCarousel,
  deleteMultipleCarousels,
};
