import { Request, Response } from 'express';
import Withdrawal from '../models/withdrawal';
import Customer from '../models/customer';
import handleAsync from '../utils/handleAsync';

// 构建查询条件
const buildQuery = async (queryParams: any): Promise<any> => {
  const query: any = {};

  // 通过客户名称查询
  if (queryParams.customer) {
    let searchText;
    try {
      const customerParam = JSON.parse(String(queryParams.customer));
      searchText = customerParam.username;
    } catch (e) {
      searchText = String(queryParams.customer).trim();
    }

    const customerData = await Customer.find({
      username: { $regex: searchText, $options: 'i' },
    });

    if (customerData && customerData.length > 0) {
      query.customer = { $in: customerData.map((customer) => customer._id) };
    } else {
      return null;
    }
  }

  // 状态查询
  if (queryParams.status) {
    query.status = queryParams.status;
  }

  // 金额范围查询
  if (queryParams.minAmount || queryParams.maxAmount) {
    query.amount = {};
    if (queryParams.minAmount) {
      query.amount.$gte = Number(queryParams.minAmount);
    }
    if (queryParams.maxAmount) {
      query.amount.$lte = Number(queryParams.maxAmount);
    }
  }

  return query;
};

// 获取提现列表
const getWithdrawals = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query);

  if (query === null) {
    res.json({
      success: true,
      data: [],
      total: 0,
      current: +current,
      pageSize: +pageSize,
    });
    return;
  }

  const withdrawals = await Withdrawal.find(query)
    .populate('customer', 'username _id')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .lean()
    .exec();

  const total = await Withdrawal.countDocuments(query).exec();

  res.json({
    success: true,
    data: withdrawals,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 创建提现申请
const createWithdrawal = handleAsync(async (req: Request, res: Response) => {
  const { customer, amount, bankAccount, bankName, accountHolder, remarks } =
    req.body;

  const customerExists = await Customer.findById(customer);
  if (!customerExists) {
    res.status(404);
    throw new Error('客户不存在');
  }

  const withdrawal = await Withdrawal.create({
    customer,
    amount: Number(amount),
    bankAccount,
    bankName,
    accountHolder,
    status: 'pending',
    remarks,
  });

  const populatedWithdrawal = await Withdrawal.findById(
    withdrawal._id,
  ).populate('customer', 'username');

  res.status(201).json({
    success: true,
    data: populatedWithdrawal,
  });
});

// 更新提现状态
const updateWithdrawalStatus = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, remarks } = req.body;

    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      res.status(404);
      throw new Error('提现记录不存在');
    }

    const updateData: any = { status, remarks };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    const updatedWithdrawal = await Withdrawal.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true },
    ).populate('customer', 'username');

    res.json({
      success: true,
      data: updatedWithdrawal,
    });
  },
);

// 获取单个提现记录
const getWithdrawalById = handleAsync(async (req: Request, res: Response) => {
  const withdrawal = await Withdrawal.findById(req.params.id).populate(
    'customer',
    'username',
  );

  if (!withdrawal) {
    res.status(404);
    throw new Error('提现记录不存在');
  }

  res.json({
    success: true,
    data: withdrawal,
  });
});

// ... existing code ...

// 删除提现记录
const deleteWithdrawal = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const withdrawal = await Withdrawal.findByIdAndDelete(id);

  if (!withdrawal) {
    res.status(404);
    throw new Error('提现记录不存在');
  }

  res.json({
    success: true,
    data: { message: '提现记录删除成功' },
  });
});

// 批量删除提现记录
const deleteMultipleWithdrawals = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Withdrawal.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `成功删除 ${ids.length} 条提现记录`,
    });
  },
);

export {
  getWithdrawals,
  createWithdrawal,
  updateWithdrawalStatus,
  getWithdrawalById,
  deleteWithdrawal, // 添加新的导出
  deleteMultipleWithdrawals, // 添加新的导出
};
