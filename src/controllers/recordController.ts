import { Request, Response } from 'express';
import Record from '../models/record';
import handleAsync from '../utils/handleAsync';
import User from '../models/user';
import { isProxy } from '../middlewares/authMiddleware';
import { RequestCustom } from 'user';
import Customer from '../models/customer';

// dataPermissionController.ts
const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  if (queryParams.type) {
    query.type = queryParams.type;
  }

  // customer
  if (queryParams.customer) {
    const customer = await Customer.findOne({
      address: queryParams.customer,
    });
    query.customer = customer._id;
  }

  if (isProxy(req.user)) {
    const employees = await User.find({ proxy: req.user._id });
    const employeeIds = employees.map((employee) => employee._id);
    query.employee = { $in: [...employeeIds, req.user._id] };
  }

  return query;
};

// Get all records
const getRecords = handleAsync(async (req: RequestCustom, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query, req);

  const records = await Record.find(query)
    .populate('customer')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Record.countDocuments(query).exec();

  res.json({
    success: true,
    data: records,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// Get record by ID
const getRecordById = handleAsync(async (req: Request, res: Response) => {
  const record = await Record.findById(req.params.id).populate('customer');

  if (!record) {
    res.status(404);
    throw new Error('Record not found');
  }

  res.json({
    success: true,
    data: record,
  });
});

// Get records by customer ID
const getRecordsByCustomerId = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const records = await Record.find({
      customer: req.customer._id,
      type: req.body.type,
    })
      .populate('customer')
      .sort({ createdAt: 1 })
      .exec();

    res.json({
      success: true,
      data: records,
    });
  },
);

export { getRecords, getRecordById, getRecordsByCustomerId };
