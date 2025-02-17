import { Request, Response } from 'express';
import MiningData from '../models/miningData';
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

// 获取挖矿数据列表
export const getMiningDataList = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = buildQuery({
      ...req.query,
      user: req.user,
      getAllData: req.getAllData,
    });

    const miningData = await MiningData.find(query)
      .sort('-createdAt')
      .limit(+pageSize)
      .skip((+current - 1) * +pageSize)
      .exec();

    const total = await MiningData.countDocuments(query);

    res.json({
      success: true,
      data: miningData,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

// 添加挖矿数据
export const addMiningData = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const newMiningData = new MiningData({
      ...req.body,
      createdAt: new Date(),
    });

    const savedMiningData = await newMiningData.save();

    res.status(201).json({
      success: true,
      data: savedMiningData,
    });
  },
);

// 获取单个挖矿数据
export const getMiningDataById = handleAsync(
  async (req: Request, res: Response) => {
    const miningData = await MiningData.findById(req.params.id);

    if (!miningData) {
      res.status(404);
      throw new Error('Mining data not found');
    }

    res.json({
      success: true,
      data: miningData,
    });
  },
);

// 更新挖矿数据
export const updateMiningData = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    const miningData = await MiningData.findById(id);

    if (!miningData) {
      res.status(404);
      throw new Error('挖矿数据未找到');
    }

    const updatedMiningData = await MiningData.findByIdAndUpdate(
      id,
      updateData,
      { new: true },
    );

    res.json({
      success: true,
      data: updatedMiningData,
    });
  },
);

// 删除挖矿数据
export const deleteMiningData = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const miningData = await MiningData.findByIdAndDelete(id);

    if (!miningData) {
      res.status(404);
      throw new Error('挖矿数据未找到');
    }

    res.json({
      success: true,
      data: { message: 'Mining data deleted successfully' },
    });
  },
);

// 批量删除挖矿数据
export const deleteMultipleMiningData = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await MiningData.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} mining data records deleted successfully`,
    });
  },
);

// 获取最新的挖矿数据
export const getLatestMiningData = handleAsync(
  async (req: Request, res: Response) => {
    const latestData = await MiningData.findOne().sort({ createdAt: -1 });

    if (!latestData) {
      res.status(404);
      throw new Error('No mining data found');
    }

    res.json({
      success: true,
      data: latestData,
    });
  },
);
