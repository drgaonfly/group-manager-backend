import { Request, Response } from 'express';
import Income from '../models/income';
import handleAsync from '../utils/handleAsync';

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.customer) {
    query.customer = queryParams.customer;
  }

  if (queryParams.coinName) {
    query.coinName = { $regex: new RegExp(queryParams.coinName, 'i') };
  }

  return query;
};

// 获取所有收入记录
const getIncomes = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const incomes = await Income.find(query)
    .populate({
      path: 'wallet',
      populate: 'user',
    }) // 如果需要填充客户信息
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Income.countDocuments(query).exec();

  res.json({
    success: true,
    data: incomes,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 添加收入记录
const addIncome = handleAsync(async (req: Request, res: Response) => {
  const newIncome = new Income({
    ...req.body,
  });

  const savedIncome = await newIncome.save();
  res.json({
    success: true,
    data: savedIncome,
  });
});

// 根据 ID 获取收入记录
const getIncomeById = handleAsync(async (req: Request, res: Response) => {
  const income = await Income.findById(req.params.id).populate('customer');

  res.json({
    success: true,
    data: income,
  });
});

// 更新收入记录
const updateIncome = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedIncome = await Income.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true, runValidators: true },
  );

  res.json({
    success: true,
    data: updatedIncome,
  });
});

// 删除收入记录
const deleteIncome = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const income = await Income.findByIdAndDelete(id);

  res.json({
    success: true,
    message: income,
  });
});

// 批量删除收入记录
const deleteMultipleIncomes = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Income.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} incomes deleted successfully`,
    });
  },
);

// 导出控制器方法
export {
  deleteMultipleIncomes,
  updateIncome,
  deleteIncome,
  getIncomes,
  addIncome,
  getIncomeById,
};
