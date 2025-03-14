import { Request, Response } from 'express';
import ReleaseRecord from '../models/releaseRecord';
import handleAsync from '../utils/handleAsync';
import Customer from '../models/customer';

// Helper function to build query
const buildReleaseRecordQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.user) {
    query.user = queryParams.user;
  }

  if (queryParams.wallet) {
    query.wallet = queryParams.wallet;
  }

  if (queryParams.activity) {
    query.activity = queryParams.activity;
  }

  if (queryParams.status) {
    query.status = queryParams.status;
  }

  return query;
};

// Get all release records
const getReleaseRecords = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildReleaseRecordQuery(req.query);

  const releaseRecords = await ReleaseRecord.find(query)
    .populate('customer')
    .populate('activity')
    .populate('user')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await ReleaseRecord.countDocuments(query).exec();

  res.json({
    success: true,
    data: releaseRecords,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// Add a new release record
const addReleaseRecord = handleAsync(async (req: Request, res: Response) => {
  const newReleaseRecord = new ReleaseRecord({
    ...req.body,
  });

  const savedReleaseRecord = await newReleaseRecord.save();

  res.json({
    success: true,
    data: savedReleaseRecord,
  });
});

// Get release record by ID
const getReleaseRecordById = handleAsync(
  async (req: Request, res: Response) => {
    const releaseRecord = await ReleaseRecord.findById(req.params.id)
      .populate('user')
      .populate({
        path: 'wallet',
        populate: 'user',
      })
      .populate({
        path: 'activity',
        populate: {
          path: 'user',
        },
      });

    if (!releaseRecord) {
      res.status(404);
      throw new Error('Release record not found');
    }

    res.json({
      success: true,
      data: releaseRecord,
    });
  },
);

// Update release record
const updateReleaseRecord = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 首先获取现有记录以检查当前状态
  const existingRecord = await ReleaseRecord.findById(id);
  if (!existingRecord) {
    res.status(404);
    throw new Error('Release record not found');
  }

  // 检查是否试图将成功状态改回待处理
  if (existingRecord.status === 'success' && req.body.status === 'pending') {
    res.status(400);
    throw new Error('不能将状态从成功改回待处理');
  }

  // 如果状态从待处理改为成功
  if (existingRecord.status === 'pending' && req.body.status === 'success') {
    // 获取客户记录
    const customer = await Customer.findById(existingRecord.customer);
    if (!customer) {
      res.status(404);
      throw new Error('Customer not found');
    }

    // 检查客户是否有足够的USDT质押余额
    if (customer.usdtStaking < existingRecord.stakedUsdt) {
      res.status(400);
      throw new Error('USDT质押余额不足');
    }

    // 更新客户余额
    const updatedCustomer = await Customer.findByIdAndUpdate(
      customer._id,
      {
        $inc: {
          usdtStaking: -existingRecord.stakedUsdt,
          ethPlatform: existingRecord.rewardEth,
        },
      },
      { new: true },
    );

    if (!updatedCustomer) {
      res.status(500);
      throw new Error('Failed to update customer balance');
    }
  }

  // 更新解押记录
  const updatedReleaseRecord = await ReleaseRecord.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  );

  res.json({
    success: true,
    data: updatedReleaseRecord,
  });
});

// Delete release record
const deleteReleaseRecord = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const releaseRecord = await ReleaseRecord.findByIdAndDelete(id);

  if (!releaseRecord) {
    res.status(404);
    throw new Error('Release record not found');
  }

  res.json({
    success: true,
    data: { message: 'Release record deleted successfully' },
  });
});

// Batch delete release records
const deleteMultipleReleaseRecords = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await ReleaseRecord.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} release records deleted successfully`,
    });
  },
);

export {
  getReleaseRecords,
  addReleaseRecord,
  getReleaseRecordById,
  updateReleaseRecord,
  deleteReleaseRecord,
  deleteMultipleReleaseRecords,
};
