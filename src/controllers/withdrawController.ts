import { Request, Response } from 'express';
import Withdraw from '../models/withdraw';
import handleAsync from '../utils/handleAsync';

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

// 获取所有提现记录
const getWithdraws = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const withdraws = await Withdraw.find(query)
    .populate('user')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Withdraw.countDocuments(query).exec();

  res.json({
    success: true,
    data: withdraws,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 添加提现记录
const addWithdraw = handleAsync(async (req: Request, res: Response) => {
  const newWithdraw = new Withdraw({
    ...req.body,
  });

  const savedWithdraw = await newWithdraw.save();
  res.json({
    success: true,
    data: savedWithdraw,
  });
});

// 根据 ID 获取提现记录
const getWithdrawById = handleAsync(async (req: Request, res: Response) => {
  const withdraw = await Withdraw.findById(req.params.id).populate('user');

  res.json({
    success: true,
    data: withdraw,
  });
});

// 更新提现记录
const updateWithdraw = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedWithdraw = await Withdraw.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true, runValidators: true },
  );

  res.json({
    success: true,
    data: updatedWithdraw,
  });
});

// 删除提现记录
const deleteWithdraw = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const withdraw = await Withdraw.findByIdAndDelete(id);

  res.json({
    success: true,
    message: withdraw,
  });
});

// 批量删除提现记录
const deleteMultipleWithdraws = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Withdraw.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} withdraws deleted successfully`,
    });
  },
);

// 导出控制器方法
export {
  deleteMultipleWithdraws,
  updateWithdraw,
  deleteWithdraw,
  getWithdraws,
  addWithdraw,
  getWithdrawById,
};
