import { Request, Response } from 'express';
import Withdraw from '../models/withdraw';
import handleAsync from '../utils/handleAsync';
import Customer, { ICustomer } from '../models/customer';
import { IdGen } from '../utils/idGen';
import { RequestCustom } from 'user';
import { isProxy } from '../middlewares/authMiddleware';
import User, { IUser } from '../models/user';
import Setting from '../models/setting';
import { filterCustomerAddress } from './incomeController';

const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  if (queryParams.customer) {
    let searchText;
    try {
      const userParam = JSON.parse(String(queryParams.customer));
      searchText = userParam.address;
    } catch (e) {
      searchText = String(queryParams.customer).trim();
    }
    const customerData = await Customer.find({
      address: {
        $regex: searchText,
        $options: 'i',
      },
    });

    if (customerData && customerData.length > 0) {
      query.customer = { $in: customerData.map((customer) => customer._id) };
    }
  }

  // 处理 status 查询
  if (queryParams.status) {
    query.status = queryParams.status;
  }

  // isFrozen
  if (queryParams.isFrozen) {
    query.isFrozen = queryParams.isFrozen === 'true';
  }

  if (isProxy(req.user)) {
    const employees = await User.find({ proxy: req.user._id });
    const employeeIds = employees.map((employee) => employee._id);
    query.employee = { $in: [...employeeIds, req.user._id] };
  }

  return query;
};

// Get all withdraws
const getWithdraws = handleAsync(async (req: RequestCustom, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  let query = await buildQuery(req.query, req);

  // 处理 customer 查询
  query = await filterCustomerAddress(req, query, res);

  const withdraws = await Withdraw.find(query)
    .populate('customer')
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

// Add new withdraw
const addWithdraw = handleAsync(async (req: RequestCustom, res: Response) => {
  const { amount, isFrozen = false } = req.body;

  const customer = req.customer;

  if (Number(amount) <= 0) {
    res.status(400);
    throw new Error('提现金额不能小于0');
  }

  if (Number(amount) > Number(customer.usdtPlatform)) {
    res.status(400);
    throw new Error('USDT余额不足');
  }

  // 获取提现手续费比例
  const feeSetting = await Setting.findOne({ key: 'withdraw' });
  if (!feeSetting) {
    res.status(500);
    throw new Error('提现手续费设置不存在');
  }

  // 计算手续费
  const feePercentage = Number(feeSetting.value) / 100;
  const feeAmount = Number(amount) * feePercentage;
  const finalAmount = Number(amount) - feeAmount;

  const newId = await IdGen.next(Withdraw, 'id', 6);

  // 减少用户的可用余额，并将金额转移到 frozenAmount
  customer.usdtPlatform -= Number(amount);
  customer.frozenAmount += Number(amount);
  await customer.save();

  const newWithdraw = new Withdraw({
    ...req.body,
    employee: (customer.employee as IUser)?._id,
    id: newId,
    customer,
    amount,
    fee: feeAmount,
    finalAmount,
    isFrozen,
    status: 'pending',
  });

  const savedWithdraw = await newWithdraw.save();
  res.json({
    success: true,
    data: savedWithdraw,
  });
});

// Get withdraw by ID
const getWithdrawById = handleAsync(async (req: Request, res: Response) => {
  const withdraw = await Withdraw.findById(req.params.id).populate('customer');

  if (!withdraw) {
    res.status(404);
    throw new Error('Withdraw not found');
  }

  res.json({
    success: true,
    data: withdraw,
  });
});

// Update withdraw
const updateWithdraw = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isFrozen, status } = req.body;

  const withdraw = await Withdraw.findById(id).populate('customer');

  const customer = withdraw.customer as ICustomer;

  if (!withdraw) {
    res.status(404);
    throw new Error('Withdraw not found');
  }

  if (withdraw.status === 'rejected' && isFrozen !== withdraw.isFrozen) {
    res.status(400);
    throw new Error('已拒接提现记录，不可更改');
  }

  // 如果原记录已经是冻结状态，不允许改为非冻结
  if (withdraw.isFrozen && !isFrozen) {
    res.status(400);
    throw new Error('已提现记录，不可更改');
  }

  // 处理状态变更为拒绝的情况
  if (status === 'rejected' && withdraw.status !== 'rejected') {
    customer.usdtBalance += withdraw.amount + withdraw.fee;
    // 获取用户并返回冻结金额
    customer.frozenAmount -= withdraw.amount;
    await customer.save();
  }

  if (isFrozen) {
    // 仅需将状态更新为已完成
    customer.frozenAmount -= withdraw.amount;
    req.body.status = 'completed';
  }

  const updatedWithdraw = await Withdraw.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true, runValidators: true },
  ).populate('customer');

  res.json({
    success: true,
    data: updatedWithdraw,
  });
});

// Delete withdraw
const deleteWithdraw = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const withdraw = await Withdraw.findById(id);
  if (!withdraw) {
    res.status(404);
    throw new Error('Withdraw not found');
  }

  await withdraw.deleteOne();

  res.json({
    success: true,
    message: 'Withdraw deleted successfully',
  });
});

// Delete multiple withdraws
const deleteMultipleWithdraws = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    const result = await Withdraw.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${result.deletedCount} withdraws deleted successfully`,
    });
  },
);

// get withdraw by customer id
const getWithdrawByCustomerId = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const withdraws = await Withdraw.find({ customer: req.customer._id }).sort({
      createdAt: 1,
    }); // -1 means descending order, newest first

    res.json({
      success: true,
      data: withdraws,
    });
  },
);

// Export controller methods
export {
  deleteMultipleWithdraws,
  updateWithdraw,
  deleteWithdraw,
  getWithdraws,
  addWithdraw,
  getWithdrawById,
  getWithdrawByCustomerId,
};
