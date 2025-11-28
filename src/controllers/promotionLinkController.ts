import { Request, Response } from 'express';
import PromotionLink from '../models/promotionLink';
import handleAsync from '../utils/handleAsync';
import { generatePromotionCode } from '../utils/generatePromotionCode';

// 构建查询参数
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.title) {
    query.title = { $regex: queryParams.title, $options: 'i' };
  }

  if (queryParams.code) {
    query.code = { $regex: queryParams.code, $options: 'i' };
  }

  if (queryParams.link) {
    query.link = { $regex: queryParams.link, $options: 'i' };
  }

  return query;
};

// 获取所有推广链接
export const getPromotionLinks = handleAsync(
  async (req: Request, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = buildQuery(req.query);

    const promotionLinks = await PromotionLink.find(query)
      .sort('-createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    const total = await PromotionLink.countDocuments(query).exec();

    res.json({
      success: true,
      data: promotionLinks,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

// 获取单个推广链接
export const getPromotionLinkById = handleAsync(
  async (req: Request, res: Response) => {
    const promotionLink = await PromotionLink.findById(req.params.id).exec();

    if (!promotionLink) {
      res.status(404);
      throw new Error('推广链接未找到');
    }

    res.json({
      success: true,
      data: promotionLink,
    });
  },
);

// 添加推广链接
export const addPromotionLink = handleAsync(
  async (req: Request, res: Response) => {
    // 生成随机码（6-8位随机）
    const codeLength = Math.floor(Math.random() * 3) + 6; // 6, 7, 8 随机选择
    const code = await generatePromotionCode(codeLength, PromotionLink);

    const newPromotionLink = new PromotionLink({
      ...req.body,
      code,
    });

    const savedPromotionLink = await newPromotionLink.save();

    res.status(201).json({
      success: true,
      data: savedPromotionLink,
    });
  },
);

// 更新推广链接
export const updatePromotionLink = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    // 不允许更新 code 字段
    const { code, ...updateData } = req.body;

    const updatedPromotionLink = await PromotionLink.findByIdAndUpdate(
      id,
      updateData,
      { new: true },
    ).exec();

    if (!updatedPromotionLink) {
      res.status(404);
      throw new Error('推广链接未找到');
    }

    res.json({
      success: true,
      data: updatedPromotionLink,
    });
  },
);

// 删除推广链接
export const deletePromotionLink = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const promotionLink = await PromotionLink.findByIdAndDelete(id).exec();

    if (!promotionLink) {
      res.status(404);
      throw new Error('推广链接未找到');
    }

    res.json({
      success: true,
      data: { message: '推广链接删除成功' },
    });
  },
);

// 批量删除推广链接
export const deleteMultiplePromotionLinks = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await PromotionLink.deleteMany({
      _id: { $in: ids },
    }).exec();

    res.json({
      success: true,
      message: `成功删除 ${ids.length} 个推广链接`,
    });
  },
);
