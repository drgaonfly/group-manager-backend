import { Request, Response } from 'express';
import DepthIncome from '../models/depthIncome';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.address) {
    query.address = { $regex: queryParams.address, $options: 'i' };
  }

  if (queryParams.network) {
    query.network = queryParams.network;
  }

  return query;
};

// 获取深度收益数据列表
export const getDepthIncomeList = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = buildQuery({
      ...req.query,
    });

    const depthIncome = await DepthIncome.find(query)
      .sort({ depth: 1 })
      .limit(+pageSize)
      .skip((+current - 1) * +pageSize)
      .exec();

    const total = await DepthIncome.countDocuments(query);

    res.json({
      success: true,
      data: depthIncome,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

// 前端获取所有深度收益数据
export const getAllDepthIncome = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const query = {};

    const depthIncome = await DepthIncome.find(query).sort({ depth: 1 }).exec();

    res.json({
      success: true,
      data: depthIncome,
    });
  },
);

// 添加深度收益数据
export const addDepthIncome = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const newDepthIncome = new DepthIncome({
      ...req.body,
      createdAt: new Date(),
    });

    const savedDepthIncome = await newDepthIncome.save();

    res.status(201).json({
      success: true,
      data: savedDepthIncome,
    });
  },
);

// 获取单个深度收益数据
export const getDepthIncomeById = handleAsync(
  async (req: Request, res: Response) => {
    const depthIncome = await DepthIncome.findById(req.params.id);

    if (!depthIncome) {
      res.status(404);
      throw new Error('深度收益数据未找到');
    }

    res.json({
      success: true,
      data: depthIncome,
    });
  },
);

// 更新深度收益数据
export const updateDepthIncome = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    const depthIncome = await DepthIncome.findById(id);

    if (!depthIncome) {
      res.status(404);
      throw new Error('深度收益数据未找到');
    }

    const updatedDepthIncome = await DepthIncome.findByIdAndUpdate(
      id,
      updateData,
      { new: true },
    );

    res.json({
      success: true,
      data: updatedDepthIncome,
    });
  },
);

// 删除深度收益数据
export const deleteDepthIncome = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const depthIncome = await DepthIncome.findByIdAndDelete(id);

    if (!depthIncome) {
      res.status(404);
      throw new Error('深度收益数据未找到');
    }

    res.json({
      success: true,
      data: { message: '深度收益数据删除成功' },
    });
  },
);

// 批量删除深度收益数据
export const deleteMultipleDepthIncome = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await DepthIncome.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} 条深度收益数据删除成功`,
    });
  },
);
