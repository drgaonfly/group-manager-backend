import { Request, Response } from 'express';
import VipMember from '../models/vipMember';
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

    console.log('搜索文本:', searchText);

    const customerData = await Customer.find({
      username: {
        $regex: searchText,
        $options: 'i',
      },
    });

    if (customerData && customerData.length > 0) {
      query.customer = { $in: customerData.map((customer) => customer._id) };
      console.log('查询条件:', query.customer);
    } else {
      console.log('未找到匹配的客户');
      return null;
    }
  }

  // VIP 等级查询
  if (queryParams.level) {
    query.level = Number(queryParams.level);
  }

  // 状态查询
  if (queryParams.isActive !== undefined) {
    query.isActive = queryParams.isActive === 'true';
  }

  return query;
};

// 获取 VIP 会员列表
const getVipMembers = handleAsync(async (req: Request, res: Response) => {
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

  const vipMembers = await VipMember.find(query)
    .populate('customer', 'username _id')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .lean()
    .exec();

  const total = await VipMember.countDocuments(query).exec();

  res.json({
    success: true,
    data: vipMembers,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 创建新 VIP 会员
const addVipMember = handleAsync(async (req: Request, res: Response) => {
  const { customer, level, startDate, endDate, amount } = req.body;

  try {
    const customerExists = await Customer.findById(customer);
    if (!customerExists) {
      res.status(404);
      throw new Error('客户不存在');
    }

    const vipMember = await VipMember.create({
      customer,
      level: Number(level),
      startDate,
      endDate,
      amount: Number(amount),
      isActive: true,
    });

    const populatedVipMember = await VipMember.findById(vipMember._id).populate(
      'customer',
      'username',
    );

    res.status(201).json({
      success: true,
      data: populatedVipMember,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// 获取单个 VIP 会员
const getVipMemberById = handleAsync(async (req: Request, res: Response) => {
  const vipMember = await VipMember.findById(req.params.id).populate(
    'customer',
    'username',
  );

  if (!vipMember) {
    res.status(404);
    throw new Error('VIP 会员不存在');
  }

  res.json({
    success: true,
    data: vipMember,
  });
});

// 更新 VIP 会员
const updateVipMember = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { level, endDate, isActive, amount, customer } = req.body;

  try {
    const vipMember = await VipMember.findById(id);
    if (!vipMember) {
      res.status(404);
      throw new Error('VIP 会员不存在');
    }

    // 创建更新对象
    const updateData: any = {};

    // 只更新提供的字段，并进行类型转换
    if (level !== undefined) {
      const vipLevel = parseInt(level);
      if (isNaN(vipLevel) || vipLevel < 1 || vipLevel > 5) {
        throw new Error('VIP 等级必须是 1-5 之间的数字');
      }
      updateData.level = vipLevel;
    }

    if (endDate !== undefined) {
      updateData.endDate = endDate;
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    if (amount !== undefined) {
      const vipAmount = Number(amount);
      if (isNaN(vipAmount) || vipAmount < 0) {
        throw new Error('金额必须是非负数');
      }
      updateData.amount = vipAmount;
    }

    // 添加客户更新逻辑
    if (customer) {
      const customerExists = await Customer.findById(customer);
      if (!customerExists) {
        throw new Error('客户不存在');
      }
      updateData.customer = customer;
    }

    const updatedVipMember = await VipMember.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate('customer', 'username');

    res.json({
      success: true,
      data: updatedVipMember,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// 删除 VIP 会员
const deleteVipMember = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const vipMember = await VipMember.findByIdAndDelete(id);

  if (!vipMember) {
    res.status(404);
    throw new Error('VIP 会员不存在');
  }

  res.json({
    success: true,
    data: { message: 'VIP 会员删除成功' },
  });
});

// 批量删除 VIP 会员
const deleteMultipleVipMembers = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await VipMember.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `成功删除 ${ids.length} 个 VIP 会员`,
    });
  },
);

export {
  getVipMembers,
  addVipMember,
  getVipMemberById,
  updateVipMember,
  deleteVipMember,
  deleteMultipleVipMembers,
};
