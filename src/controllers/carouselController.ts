import { Request, Response } from 'express';
import Carousel from '../models/carousel';
import handleAsync from '../utils/handleAsync';
import { CustomRequest } from './uploadController';
import {
  transformDocumentImage,
  transformDocumentImages,
} from '../utils/transformUtils';

// dataPermissionController.ts
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.brandName) {
    query.brandName = queryParams.brandName;
  }

  if (queryParams.skuName) {
    query.skuName = { $regex: new RegExp(queryParams.skuName, 'i') };
  }

  if (queryParams.sn) {
    query.sn = queryParams.sn;
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

  // 处理图片路径
  const processedCarousels = await transformDocumentImage(carousels, ['image']);

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
  const processedcarousel = await transformDocumentImage(carousel, 'image');

  res.json({
    success: true,
    data: {
      ...processedcarousel,
    },
  });
});

const updateCarousel = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedWallet = await Carousel.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true, runValidators: true },
  );

  res.json({
    success: true,
    data: updatedWallet,
  });
});

// 删除轮播图
const deleteCarousel = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 删除轮播图
  const carousel = await Carousel.findByIdAndDelete(id);

  if (!carousel) {
    res.status(404);
    throw new Error('carousel not found');
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
