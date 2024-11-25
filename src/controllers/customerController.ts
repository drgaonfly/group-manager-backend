import { Request, Response } from 'express';
import Customer from '../models/customer';
import handleAsync from '../utils/handleAsync';

// 构建查询条件
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.username) {
    query.username = queryParams.username;
  }

  if (queryParams.email) {
    query.email = { $regex: queryParams.email, $options: 'i' };
  }

  if (queryParams.phone) {
    query.phone = { $regex: queryParams.phone, $options: 'i' };
  }

  if (queryParams.status) {
    query.status = queryParams.status;
  }

  return query;
};

// 获取客户列表
const getCustomers = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const customers = await Customer.find(query)
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
  const { username, email, phone, address, status } = req.body;

  try {
    // 检查邮箱是否已存在
    const customerExists = await Customer.findOne({ email });
    if (customerExists) {
      res.status(400);
      throw new Error('该邮箱已被注册，请使用其他邮箱');
    }

    // 检查用户名是否已存在
    const usernameExists = await Customer.findOne({ username });
    if (usernameExists) {
      // res.status(400);
      throw new Error('该用户名已被使用，请选择其他用户名');
    }

    const customer = await Customer.create({
      username,
      email: email.toLowerCase(),
      phone,
      address,
      status: status || 'active',
    });

    res.status(201).json({
      success: true,
      data: customer,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const message =
        field === 'email'
          ? '该邮箱已被注册，请使用其他邮箱'
          : '该用户名已被使用，请选择其他用户名';

      res.status(400).json({
        success: false,
        message: message,
      });
    } else {
      throw error;
    }
  }
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
    data: customer,
  });
});

// 更新客户
const updateCustomer = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { email, username } = req.body;

  try {
    const customer = await Customer.findById(id);
    if (!customer) {
      res.status(404);
      throw new Error('客户不存在');
    }

    // 检查邮箱唯一性
    if (email && email !== customer.email) {
      const emailExists = await Customer.findOne({ email, _id: { $ne: id } });
      if (emailExists) {
        res.status(400);
        throw new Error('该邮箱已被其他用户使用');
      }
    }

    // 检查用户名唯一性
    if (username && username !== customer.username) {
      const usernameExists = await Customer.findOne({
        username,
        _id: { $ne: id },
      });
      if (usernameExists) {
        res.status(400);
        throw new Error('该用户名已被其他用户使用');
      }
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      {
        ...req.body,
        email: email?.toLowerCase(),
      },
      { new: true, runValidators: true },
    );

    res.json({
      success: true,
      data: updatedCustomer,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const message =
        field === 'email'
          ? '该邮箱已被其他用户使用'
          : '该用户名已被其他用户使用';

      res.status(400).json({
        success: false,
        message: message,
      });
    } else {
      throw error;
    }
  }
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
