import { Request, Response } from 'express';
import ReleaseRecord from '../models/releaseRecord';
import handleAsync from '../utils/handleAsync';

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
    .populate({
      path: 'wallet',
      populate: 'user',
    })
    .populate('activity')
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
      .populate('activity');

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
  const updatedReleaseRecord = await ReleaseRecord.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  )
    .populate('user')
    .populate('wallet')
    .populate('activity');

  if (!updatedReleaseRecord) {
    res.status(404);
    throw new Error('Release record not found');
  }

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
