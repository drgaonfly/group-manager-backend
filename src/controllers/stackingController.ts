import { Request, Response } from 'express';
import Stacking from '../models/stacking';
import handleAsync from '../utils/handleAsync';
import Customer, { ICustomer } from '../models/customer';
import { IUser } from '../models/user';
import { RequestCustom } from 'user';
import { queryByProxy } from './withdrawController';
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

  // status
  if (queryParams.status) {
    query.status = queryParams.status;
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

  await queryByProxy(query, req);

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

// 更新
const updateStaking = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  // 先获取当前记录
  const stacking = await Stacking.findById(id).populate('customer');

  if (!stacking) {
    res.status(404);
    throw new Error('记录不存在');
  }

  const updatedStacking = await Stacking.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  res.json({
    success: true,
    data: updatedStacking,
  });
});

// 确认质押金额
const checkStacking = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 先获取当前记录
  const stacking = await Stacking.findById(id).populate('customer');

  if (!stacking) {
    res.status(404);
    throw new Error('记录不存在');
  }

  const customer = stacking.customer as ICustomer;

  // 如果当前记录已经是冻结状态，不允许改为未冻结
  if (stacking.status === 'confirmed') {
    res.status(400);
    throw new Error('已确认的记录不能改为冻结状态');
  }

  // 检查冻结金额是否足够
  if (customer.stakingFrozenAmount < stacking.amount) {
    res.status(400);
    throw new Error('冻结金额不足');
  }

  // 查找并更新转出方的质押金额
  await Customer.findByIdAndUpdate(
    customer._id,
    {
      $inc: {
        usdtStaking: stacking.amount,
        stakingFrozenAmount: -stacking.amount,
      },
      stackingAt: new Date(), // 添加质押时间
    },
    { new: true },
  );

  // 使用原子性操作更新状态和确认时间
  await Stacking.findByIdAndUpdate(
    stacking._id,
    {
      $set: {
        status: 'confirmed', // 设置为解结状态
        confirmedAt: new Date(), // 添加确认时间
      },
    },
    { new: true },
  );

  res.json({
    success: true,
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

    const proxy = customer?.proxy as IUser;

    const {
      toAddress, // 转入方地址
      amount, // 转账金额
    } = req.body;

    // 检查用户是否有足够的余额
    if (customer.usdtPlatform < Number(amount)) {
      res.status(400);
      throw new Error('余额不足');
    }

    // 记录质押转账记录
    await Stacking.create({
      customer: customer._id,
      fromAddress: customer.address, // 转出地址
      fromNetwork: customer.network, // 转出网络
      toAddress,
      toNetwork: customer.network,
      amount,
      employee: user?._id, // 员工
      proxy: proxy?._id, // 代理
    });

    await Customer.findByIdAndUpdate(customer._id, {
      $inc: {
        usdtPlatform: -Number(amount),
        stakingFrozenAmount: +Number(amount),
      },
    });

    res.json({
      success: true,
      message: '质押转账成功',
    });
  },
);

// 导出控制器方法
export {
  deleteMultipleStackings,
  updateStaking,
  deleteStacking,
  getStackings,
  addStacking,
  getStackingById,
  handleStackingTransfer,
  checkStacking,
};
