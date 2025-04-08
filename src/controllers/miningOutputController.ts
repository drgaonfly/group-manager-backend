import { Request, Response } from 'express';
import MiningOutput from '../models/miningOutput';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.address) {
    query.address = { $regex: queryParams.address, $options: 'i' };
  }

  if (queryParams.usdtNumber) {
    query.usdtNumber = { $regex: queryParams.usdtNumber, $options: 'i' };
  }

  return query;
};

// 获取挖矿数据列表
export const getMiningOutputList = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = buildQuery({
      ...req.query,
    });

    const miningOutput = await MiningOutput.find(query)
      .sort('-createdAt')
      .limit(+pageSize)
      .skip((+current - 1) * +pageSize)
      .exec();

    const total = await MiningOutput.countDocuments(query);

    res.json({
      success: true,
      data: miningOutput,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

// 辅助函数：生成随机钱包地址
const generateRandomAddress = (): string => {
  const types = ['0x', 'T']; // ETH和TRX地址前缀
  const type = types[Math.floor(Math.random() * types.length)];

  if (type === '0x') {
    // 生成类似ETH的地址
    const chars = '0123456789abcdefABCDEF';
    let address = '0x';
    for (let i = 0; i < 40; i++) {
      address += chars[Math.floor(Math.random() * chars.length)];
    }
    return address;
  } else {
    // 生成类似TRX的地址
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let address = 'T';
    for (let i = 0; i < 33; i++) {
      address += chars[Math.floor(Math.random() * chars.length)];
    }
    return address;
  }
};

// 辅助函数：生成随机USDT数量
const generateRandomUSDT = (): number => {
  // 生成10到1000之间的随机数，保留2位小数
  return Number((Math.random() * 990 + 10).toFixed(2));
};

// 添加挖矿数据
export const addMiningOutput = handleAsync(
  async (req: RequestCustom, res: Response): Promise<void> => {
    // 检查是否需要生成随机数据
    if (req.query.generate === 'true') {
      const count = Number(req.query.count) || 500; // 默认生成500条
      const randomData = [];

      for (let i = 0; i < count; i++) {
        randomData.push({
          address: generateRandomAddress(),
          usdtNumber: generateRandomUSDT(),
        });
      }

      // 批量插入数据
      const savedMiningOutputs = await MiningOutput.insertMany(randomData);

      res.json({
        success: true,
        message: `Successfully generated ${count} random mining outputs`,
        count: savedMiningOutputs.length,
      });
    }

    // 原有的单条数据添加逻辑
    const newMiningOutput = new MiningOutput({
      ...req.body,
      createdAt: new Date(),
    });

    const savedMiningOutput = await newMiningOutput.save();

    res.status(201).json({
      success: true,
      data: savedMiningOutput,
    });
  },
);

// 获取单个挖矿数据
export const getMiningOutputById = handleAsync(
  async (req: Request, res: Response) => {
    const miningOutput = await MiningOutput.findById(req.params.id);

    if (!miningOutput) {
      res.status(404);
      throw new Error('挖矿数据未找到');
    }

    res.json({
      success: true,
      data: miningOutput,
    });
  },
);

// 更新挖矿数据
export const updateMiningOutput = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    const miningOutput = await MiningOutput.findById(id);

    if (!miningOutput) {
      res.status(404);
      throw new Error('挖矿数据未找到');
    }

    const updatedMiningOutput = await MiningOutput.findByIdAndUpdate(
      id,
      updateData,
      { new: true },
    );

    res.json({
      success: true,
      data: updatedMiningOutput,
    });
  },
);

// 删除挖矿数据
export const deleteMiningOutput = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const miningOutput = await MiningOutput.findByIdAndDelete(id);

    if (!miningOutput) {
      res.status(404);
      throw new Error('挖矿数据未找到');
    }

    res.json({
      success: true,
      data: { message: '挖矿数据删除成功' },
    });
  },
);

// 批量删除挖矿数据
export const deleteMultipleMiningOutput = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await MiningOutput.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} 挖矿数据记录删除成功`,
    });
  },
);

// 获取最新的挖矿数据
export const getLatestMiningOutput = handleAsync(
  async (req: Request, res: Response) => {
    const latestData = await MiningOutput.findOne().sort({ createdAt: -1 });

    if (!latestData) {
      res.status(404);
      throw new Error('没有找到挖矿数据');
    }

    res.json({
      success: true,
      data: latestData,
    });
  },
);
