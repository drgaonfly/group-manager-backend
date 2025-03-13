import { Request, Response } from 'express';
import Record from '../models/record';
import handleAsync from '../utils/handleAsync';

// dataPermissionController.ts
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.type) {
    query.type = queryParams.type;
  }

  return query;
};

// Get all records
const getRecords = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

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
  async (req: Request, res: Response) => {
    const records = await Record.find({
      customer: req.params.id,
      type: req.body.type,
    })
      .populate('customer')
      .sort('-createdAt')
      .exec();

    res.json({
      success: true,
      data: records,
    });
  },
);

export { getRecords, getRecordById, getRecordsByCustomerId };
