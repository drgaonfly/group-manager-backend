import { Request, Response } from 'express';
import Stacking from '../models/stacking';
import handleAsync from '../utils/handleAsync';
import Customer from '../models/customer';

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.investBalance) {
    query.investBalance = +queryParams.investBalance;
  }

  if (queryParams.rateOfReturn) {
    query.rateOfReturn = +queryParams.rateOfReturn;
  }

  return query;
};

// 获取所有叠加配置记录
const getStackings = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const stackings = await Stacking.find(query)
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Stacking.countDocuments(query).exec();

  res.json({
    success: true,
    data: stackings,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 添加叠加配置记录
const addStacking = handleAsync(async (req: Request, res: Response) => {
  const newStacking = new Stacking({
    ...req.body,
  });

  const savedStacking = await newStacking.save();
  res.json({
    success: true,
    data: savedStacking,
  });
});

// 根据 ID 获取叠加配置记录
const getStackingById = handleAsync(async (req: Request, res: Response) => {
  const stacking = await Stacking.findById(req.params.id);

  res.json({
    success: true,
    data: stacking,
  });
});

// 更新叠加配置记录
const updateStacking = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedStacking = await Stacking.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true, runValidators: true },
  );

  res.json({
    success: true,
    data: updatedStacking,
  });
});

// 删除叠加配置记录
const deleteStacking = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const stacking = await Stacking.findByIdAndDelete(id);

  res.json({
    success: true,
    message: stacking,
  });
});

// 批量删除叠加配置记录
const deleteMultipleStackings = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Stacking.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} stackings deleted successfully`,
    });
  },
);

// 处理质押转账
const handleStackingTransfer = handleAsync(
  async (req: Request, res: Response) => {
    const {
      fromAddress, // 转出方地址
      fromNetwork, // 转出方网络
      toAddress, // 转入方地址
      toNetwork, // 转入方网络
      amount, // 转账金额
    } = req.body;

    try {
      // 查找并更新转出方的质押金额
      const fromCustomer = await Customer.findOneAndUpdate(
        { address: fromAddress, network: fromNetwork },
        { $inc: { usdtStaking: amount } },
        { new: true },
      );

      if (!fromCustomer) {
        res.status(404).json({
          success: false,
          message: '转出方用户不存在',
        });
        return;
      }

      // 记录质押转账记录
      const stackingTransfer = await Stacking.create({
        fromAddress,
        fromNetwork,
        toAddress,
        toNetwork,
        amount,
        createdAt: new Date(),
      });

      res.json({
        success: true,
        data: {
          transfer: stackingTransfer,
          updatedCustomer: fromCustomer,
        },
        message: '质押转账成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '质押转账失败',
        error: error.message,
      });
    }
  },
);

// 导出控制器方法
export {
  deleteMultipleStackings,
  updateStacking,
  deleteStacking,
  getStackings,
  addStacking,
  getStackingById,
  handleStackingTransfer,
};
