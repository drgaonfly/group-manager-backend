import { Request, Response } from 'express';
import Stacking from '../models/stacking';
import handleAsync from '../utils/handleAsync';
import Customer, { ICustomer } from '../models/customer';
import { isProxy } from '../middlewares/authMiddleware';
import User, { IUser } from '../models/user';
import { RequestCustom } from 'user';
const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  if (queryParams.fromNetwork) {
    query.fromNetwork = queryParams.fromNetwork;
  }

  if (queryParams.toNetwork) {
    query.toNetwork = queryParams.toNetwork;
  }

  // fromAddress
  if (queryParams.fromAddress) {
    query.fromAddress = {
      $regex: queryParams.fromAddress,
      $options: 'i',
    };
  }

  // toAddress
  if (queryParams.toAddress) {
    query.toAddress = {
      $regex: queryParams.toAddress,
      $options: 'i',
    };
  }

  if (isProxy(req.user)) {
    const employees = await User.find({ proxy: req.user._id });
    const employeeIds = employees.map((employee) => employee._id);
    query.employee = { $in: [...employeeIds, req.user._id] };
  }

  return query;
};

// 获取所有叠加配置记录
const getStackings = handleAsync(async (req: RequestCustom, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query, req);

  const stackings = await Stacking.find(query)
    .populate('employee')
    .populate('customer')
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
  const updateData = { ...req.body };

  // 先获取当前记录
  const stacking = await Stacking.findById(id).populate('customer');

  if (!stacking) {
    res.status(404);
    throw new Error('记录不存在');
  }

  const customer =
    (stacking.customer as ICustomer) ||
    (await Customer.findOne({
      address: stacking.fromAddress,
      network: stacking.fromNetwork,
    }));

  if (!customer) {
    res.status(404);
    throw new Error('转出方用户不存在');
  }

  // 如果当前记录已经是冻结状态，不允许改为未冻结
  if (stacking.isFrozen && updateData.isFrozen === false) {
    res.status(400);
    throw new Error('已确认的记录不能改为冻结状态');
  }

  // 如果要将状态改为冻结，需要更新用户的质押金额
  if (!stacking.isFrozen && updateData.isFrozen === true) {
    // 查找并更新转出方的质押金额
    customer.usdtStaking += stacking.amount;
    customer.stakingFrozenAmount -= stacking.amount;

    await customer.save();
  }

  const updatedStacking = await Stacking.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  res.json({
    success: true,
    data: updatedStacking,
    message: updateData.isFrozen ? '更新成功并已确认金额' : '更新成功',
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
  async (req: RequestCustom, res: Response) => {
    const customer = req.customer;

    const user = customer.employee as IUser;

    const {
      toAddress, // 转入方地址
      amount, // 转账金额
    } = req.body;

    // 记录质押转账记录
    await Stacking.create({
      customer: customer._id,
      fromAddress: customer.address, // 转出地址
      fromNetwork: customer.network, // 转出网络
      toAddress,
      toNetwork: customer.network,
      amount,
      employee: user?._id, // 员工
    });

    customer.usdtPlatform -= Number(amount);
    customer.stakingFrozenAmount += Number(amount);

    await customer.save();

    res.json({
      success: true,
      message: '质押转账成功',
    });
  },
);

// 获取指定地址的冻结金额
const getUnfrozenStackings = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const customer = req.customer;
    const { address, network } = customer;

    const stackings = await Stacking.find({
      fromAddress: address,
      fromNetwork: network,
      isFrozen: false, // 已冻结的
    }).sort('-createdAt');

    // 使用更精确的方式计算总和
    const totalAmount = stackings.reduce((sum, record) => {
      // 将数字转换为字符串，然后使用 parseFloat 处理
      const amount = parseFloat(record.amount.toString());
      return sum + amount;
    }, 0);

    // 保留4位小数
    const formattedTotalAmount = Number(totalAmount.toFixed(6));

    res.json({
      success: true,
      data: {
        records: stackings,
        totalAmount: formattedTotalAmount,
      },
    });
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
  getUnfrozenStackings,
};
