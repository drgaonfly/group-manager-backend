import { Request, Response } from 'express';
import Customer from '../models/customer';
import handleAsync from '../utils/handleAsync';

// 构建查询条件
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.user) {
    query.user = queryParams.user;
  }

  if (queryParams.phone) {
    query.phone = { $regex: queryParams.phone, $options: 'i' };
  }

  if (queryParams.status) {
    query.status = queryParams.status;
  }
  if (queryParams.isTeacher) {
    query.isTeacher = queryParams.isTeacher;
  }

  return query;
};

// 获取客户列表
const getCustomers = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const customers = await Customer.find(query)
    .populate('users')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Customer.countDocuments(query).exec();

  res.json({
    success: true,
    data: customers,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 创建新客户
const addCustomer = handleAsync(async (req: Request, res: Response) => {
  const {
    users,
    cookies,
    ip,
    certification,
    phone,
    phoneNumber,
    password,
    phoneCode,
    session,
    remarks,
    localStorage,
  } = req.body;

  // 检查proxys是否已存在
  const proxyExists = await Customer.findOne({ users });
  if (proxyExists) {
    res.status(400);
    throw new Error('该代理已被使用，请使用其他代理');
  }

  const customer = await Customer.create({
    localStorage,
    users,
    cookies,
    ip,
    certification,
    phone,
    phoneNumber,
    password,
    phoneCode,
    session,
    remarks,
  });

  res.status(201).json({
    success: true,
    data: customer,
  });
});

// 获取单个客户
const getCustomerById = handleAsync(async (req: Request, res: Response) => {
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    res.status(404);
    throw new Error('客户不存在');
  }

  res.json({
    success: true,
    data: {
      ...customer,
      localStorage: JSON.parse(customer.localStorage),
    }
  });
});

// 更新客户
const updateCustomer = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const customer = await Customer.findById(id);
  if (!customer) {
    res.status(404);
    throw new Error('客户不存在');
  }

  const updatedCustomer = await Customer.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  res.json({
    success: true,
    data: updatedCustomer,
  });
});

// 删除客户
const deleteCustomer = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const customer = await Customer.findByIdAndDelete(id);

  if (!customer) {
    res.status(404);
    throw new Error('客户不存在');
  }

  res.json({
    success: true,
    data: { message: '客户删除成功' },
  });
});

// 批量删除客户
const deleteMultipleCustomers = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Customer.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `成功删除 ${ids.length} 个客户`,
    });
  },
);

export {
  getCustomers,
  addCustomer,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  deleteMultipleCustomers,
};
