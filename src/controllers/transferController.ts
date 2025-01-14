import { Request, Response } from 'express';
import Transfer from '../models/transfer';
import handleAsync from '../utils/handleAsync';

// Helper function to build query
const buildTransferQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.wallet) {
    query.wallet = queryParams.wallet;
  }

  if (queryParams.type) {
    query.type = queryParams.type;
  }

  if (queryParams.currency) {
    query.currency = queryParams.currency;
  }

  return query;
};

// Get all transfers
const getTransfers = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildTransferQuery(req.query);

  const transfers = await Transfer.find(query)
    .populate({
      path: 'wallet',
      populate: 'user',
    })
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Transfer.countDocuments(query).exec();

  res.json({
    success: true,
    data: transfers,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// Add a new transfer
const addTransfer = handleAsync(async (req: Request, res: Response) => {
  const newTransfer = new Transfer({
    ...req.body,
  });

  const savedTransfer = await newTransfer.save();

  res.json({
    success: true,
    data: savedTransfer,
  });
});

// Get transfer by ID
const getTransferById = handleAsync(async (req: Request, res: Response) => {
  const transfer = await Transfer.findById(req.params.id).populate('wallet');

  if (!transfer) {
    res.status(404);
    throw new Error('Transfer not found');
  }

  res.json({
    success: true,
    data: transfer,
  });
});

// Update transfer
const updateTransfer = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updatedTransfer = await Transfer.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  ).populate('wallet');

  if (!updatedTransfer) {
    res.status(404);
    throw new Error('Transfer not found');
  }

  res.json({
    success: true,
    data: updatedTransfer,
  });
});

// Delete transfer
const deleteTransfer = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const transfer = await Transfer.findByIdAndDelete(id);

  if (!transfer) {
    res.status(404);
    throw new Error('Transfer not found');
  }

  res.json({
    success: true,
    data: { message: 'Transfer deleted successfully' },
  });
});

// Batch delete transfers
const deleteMultipleTransfers = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Transfer.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} transfers deleted successfully`,
    });
  },
);

export {
  getTransfers,
  addTransfer,
  getTransferById,
  updateTransfer,
  deleteTransfer,
  deleteMultipleTransfers,
};
