import { Request, Response } from 'express';
import Customer from '../models/customer';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.phoneNumber) {
    query.phoneNumber = queryParams.phoneNumber;
  }

  if (queryParams.remark) {
    query.remark = { $regex: new RegExp(queryParams.remark, 'i') };
  }

  if (queryParams.isOnline !== undefined) {
    query.isOnline = queryParams.isOnline === 'true';
  }

  return query;
};

// 获取所有客户记录
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

// 添加客户记录
const addCustomer = handleAsync(async (req: Request, res: Response) => {
  const newId = await IdGen.next(Customer, 'id', 6);

  const newCustomer = new Customer({
    ...req.body,
    id: newId,
  });

  const savedCustomer = await newCustomer.save();
  res.json({
    success: true,
    data: savedCustomer,
  });
});

// 根据 ID 获取客户记录
const getCustomerById = handleAsync(async (req: Request, res: Response) => {
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  res.json({
    success: true,
    data: customer,
  });
});

// 更新客户记录
const updateCustomer = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedCustomer = await Customer.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true, runValidators: true },
  );

  if (!updatedCustomer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  res.json({
    success: true,
    data: updatedCustomer,
  });
});

// 删除客户记录
const deleteCustomer = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const customer = await Customer.findByIdAndDelete(id);

  res.json({
    success: true,
    message: customer,
  });
});

// 批量删除客户记录
const deleteMultipleCustomers = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Customer.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} customers deleted successfully`,
    });
  },
);

// 导出控制器方法
export {
  deleteMultipleCustomers,
  updateCustomer,
  deleteCustomer,
  getCustomers,
  addCustomer,
  getCustomerById,
};
