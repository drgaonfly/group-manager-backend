import { Request, Response } from 'express';
import RegulationAgency from '../models/regulationAgency'; // 引入 RegulationAgency 模型
import handleAsync from '../utils/handleAsync';
import {
  transformDocumentImage,
  transformDocumentImages,
} from '../utils/transformUtils'; // 用于处理图像路径
import { IdGen } from '../utils/idGen';

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.createdAt) {
    query.createdAt = queryParams.createdAt;
  }

  return query;
};

// 获取所有监管机构列表
const getRegulationAgencies = handleAsync(
  async (req: Request, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = buildQuery(req.query);

    const regulationAgencies = await RegulationAgency.find(query)
      .sort('-createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    const total = await RegulationAgency.countDocuments(query);

    // 处理图标 URL
    const processedRegulationAgencies = await transformDocumentImages(
      regulationAgencies,
      ['logoUrl'],
    );

    res.json({
      success: true,
      data: processedRegulationAgencies,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

// 获取单个监管机构信息
const getRegulationAgencyById = handleAsync(
  async (req: Request, res: Response) => {
    const regulationAgency = await RegulationAgency.findById(
      req.params.id,
    ).lean();

    if (!regulationAgency) {
      res.status(404);
      throw new Error('监管机构不存在');
    }

    // 处理图标 URL
    const processedRegulationAgency = await transformDocumentImage(
      regulationAgency,
      ['logoUrl'],
    );

    res.json({
      success: true,
      data: processedRegulationAgency,
    });
  },
);

// 创建新的监管机构
const addRegulationAgency = handleAsync(async (req: Request, res: Response) => {
  const newId = await IdGen.next(RegulationAgency, 'id', 6);
  const { logoUrl } = req.body;

  const newRegulationAgency = new RegulationAgency({
    id: newId,
    logoUrl,
  });

  await newRegulationAgency.save();

  res.status(201).json({
    success: true,
    data: newRegulationAgency,
  });
});

// 更新监管机构信息
const updateRegulationAgency = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { logoUrl, ...otherFields } = req.body;

    const regulationAgency = await RegulationAgency.findById(id);
    if (!regulationAgency) {
      res.status(404);
      throw new Error('监管机构不存在');
    }

    // 更新字段
    const updates = {
      ...(logoUrl && !logoUrl.startsWith('http') && { logoUrl }),
      ...otherFields,
    };

    const updatedRegulationAgency = await RegulationAgency.findByIdAndUpdate(
      id,
      updates,
      {
        new: true,
        runValidators: true,
      },
    );

    // 处理图标 URL
    const processedRegulationAgency = await transformDocumentImage(
      updatedRegulationAgency,
      ['logoUrl'],
    );

    res.json({
      success: true,
      data: processedRegulationAgency,
    });
  },
);

// 删除监管机构
const deleteRegulationAgency = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const regulationAgency = await RegulationAgency.findByIdAndDelete(id);

    if (!regulationAgency) {
      res.status(404);
      throw new Error('监管机构不存在');
    }

    res.json({
      success: true,
      data: { message: '监管机构删除成功' },
    });
  },
);

// 批量删除监管机构
const deleteMultipleRegulationAgencies = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await RegulationAgency.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `成功删除 ${ids.length} 个监管机构`,
    });
  },
);

export {
  getRegulationAgencies,
  getRegulationAgencyById,
  addRegulationAgency,
  updateRegulationAgency,
  deleteRegulationAgency,
  deleteMultipleRegulationAgencies,
};
