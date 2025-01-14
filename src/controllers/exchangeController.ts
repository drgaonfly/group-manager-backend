import { Request, Response } from 'express';
import Exchange from '../models/exchange';
import handleAsync from '../utils/handleAsync';

// Helper function to build query
const buildExchangeQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.wallet) {
    query.wallet = queryParams.wallet;
  }

  if (queryParams.type) {
    query.type = queryParams.type;
  }

  return query;
};

// Get all exchanges
const getExchanges = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildExchangeQuery(req.query);

  const exchanges = await Exchange.find(query)
    .populate({
      path: 'wallet',
      populate: 'user',
    })
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Exchange.countDocuments(query).exec();

  res.json({
    success: true,
    data: exchanges,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// Add a new exchange
const addExchange = handleAsync(async (req: Request, res: Response) => {
  const newExchange = new Exchange({
    ...req.body,
  });

  const savedExchange = await newExchange.save();

  res.json({
    success: true,
    data: savedExchange,
  });
});

// Get exchange by ID
const getExchangeById = handleAsync(async (req: Request, res: Response) => {
  const exchange = await Exchange.findById(req.params.id).populate('wallet');

  if (!exchange) {
    res.status(404);
    throw new Error('Exchange not found');
  }

  res.json({
    success: true,
    data: exchange,
  });
});

// Update exchange
const updateExchange = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updatedExchange = await Exchange.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  ).populate('wallet');

  if (!updatedExchange) {
    res.status(404);
    throw new Error('Exchange not found');
  }

  res.json({
    success: true,
    data: updatedExchange,
  });
});

// Delete exchange
const deleteExchange = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const exchange = await Exchange.findByIdAndDelete(id);

  if (!exchange) {
    res.status(404);
    throw new Error('Exchange not found');
  }

  res.json({
    success: true,
    data: { message: 'Exchange deleted successfully' },
  });
});

// Batch delete exchanges
const deleteMultipleExchanges = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Exchange.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} exchanges deleted successfully`,
    });
  },
);

export {
  getExchanges,
  addExchange,
  getExchangeById,
  updateExchange,
  deleteExchange,
  deleteMultipleExchanges,
};
