import { Request, Response } from 'express';
import Partnership from '../models/partnership';
import handleAsync from '../utils/handleAsync';
import {
  transformDocumentImages,
  transformDocumentImage,
} from '../utils/transformUtils';
import { IdGen } from '../utils/idGen';

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.name) {
    query.name = { $regex: new RegExp(queryParams.name, 'i') };
  }

  return query;
};

// 获取合作伙伴列表
const getPartnerships = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const partnerships = await Partnership.find(query)
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize);

  const processedPartnerships = await transformDocumentImages(partnerships, [
    'logoUrl',
  ]);

  res.json({
    success: true,
    data: processedPartnerships,
  });
});

// 获取单个合作伙伴信息
const getPartnershipById = handleAsync(async (req: Request, res: Response) => {
  const partnership = await Partnership.findById(req.params.id).lean();

  if (!partnership) {
    res.status(404);
    throw new Error('合作伙伴不存在');
  }

  const processedPartnership = await transformDocumentImage(partnership, [
    'logoUrl',
  ]);

  res.json({
    success: true,
    data: processedPartnership,
  });
});

// 创建合作伙伴
const addPartnership = handleAsync(async (req: Request, res: Response) => {
  const newId = await IdGen.next(Partnership, 'id', 6);
  const { name, logoUrl, description, website } = req.body;

  const newPartnership = new Partnership({
    id: newId,
    name,
    logoUrl,
    description,
    website,
  });

  await newPartnership.save();

  res.status(201).json({
    success: true,
    data: newPartnership,
  });
});

// 更新合作伙伴信息
const updatePartnership = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedPartnership = await Partnership.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!updatedPartnership) {
    res.status(404);
    throw new Error('合作伙伴不存在');
  }

  // 处理视频路径
  const processedPartnership = await transformDocumentImage(
    updatedPartnership,
    ['logoUrl'],
  );

  res.json({
    success: true,
    data: processedPartnership,
  });
});

// 删除合作伙伴
const deletePartnership = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const partnership = await Partnership.findByIdAndDelete(id);

  if (!partnership) {
    res.status(404);
    throw new Error('合作伙伴不存在');
  }

  res.json({
    success: true,
    data: { message: '合作伙伴删除成功' },
  });
});

// 批量删除合作伙伴
const deleteMultiplePartnerships = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Partnership.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `成功删除 ${ids.length} 个合作伙伴`,
    });
  },
);

export {
  getPartnerships,
  getPartnershipById,
  addPartnership,
  updatePartnership,
  deletePartnership,
  deleteMultiplePartnerships,
};
