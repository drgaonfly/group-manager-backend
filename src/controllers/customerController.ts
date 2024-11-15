import { Request, Response } from 'express';
import Customer from '../models/customer';
import handleAsync from '../utils/handleAsync';
import Bot from '../models/bot';

// Build query based on query parameters
const buildQuery = async (queryParams: any): Promise<any> => {
  const query: any = {};

  if (queryParams.userId) {
    query.userId = queryParams.userId; // 精确匹配用户ID
  }

  if (queryParams.username) {
    query.username = { $regex: queryParams.username, $options: 'i' };
  }

  if (queryParams.firstName) {
    query.firstName = { $regex: queryParams.firstName, $options: 'i' };
  }

  if (queryParams.lastName) {
    query.lastName = { $regex: queryParams.lastName, $options: 'i' };
  }

  if (queryParams.languageCode) {
    query.languageCode = { $regex: queryParams.languageCode, $options: 'i' };
  }
  if (queryParams.bot) {
    const botData = await Bot.find({ botName: queryParams.bot });
    if (botData && botData.length > 0) {
      query.bot = {
        $in: botData.map((bot) => bot._id),
      };
    } else {
      throw new Error('Bot not found');
    }
  }

  return query;
};

// 获取所有用户
const getCustomers = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query);

  const customers = await Customer.find(query)
    .populate('bot') // 关联查询机器人信息
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Customer.countDocuments(query);

  res.json({
    success: true,
    data: customers,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 根据 ID 获取用户
const getCustomerById = handleAsync(async (req: Request, res: Response) => {
  const customer = await Customer.findById(req.params.id)
    .populate('bot')
    .exec();

  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  res.json({
    success: true,
    data: customer,
  });
});

// 添加新用户
const addCustomer = handleAsync(async (req: Request, res: Response) => {
  const newCustomer = new Customer({
    ...req.body,
  });

  const savedCustomer = await newCustomer.save();

  res.json({
    success: true,
    data: savedCustomer,
  });
});

// 更新用户
const updateCustomer = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedCustomer = await Customer.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  )
    .populate('bot')
    .exec();

  if (!updatedCustomer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  res.json({
    success: true,
    data: updatedCustomer,
  });
});

// 删除用户
const deleteCustomer = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const customer = await Customer.findByIdAndDelete(id).exec();

  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  res.json({
    success: true,
    data: { message: 'Customer deleted successfully' },
  });
});

// 批量删除用户
const deleteMultipleCustomers = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Customer.deleteMany({
      _id: { $in: ids },
    }).exec();

    res.json({
      success: true,
      message: `${ids.length} customers deleted successfully`,
    });
  },
);

export {
  getCustomers,
  getCustomerById,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  deleteMultipleCustomers,
};
