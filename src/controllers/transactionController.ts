import { Request, Response } from 'express';
import Transaction from '../models/transaction';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';

// Build query based on query parameters
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.bot) {
    query.bot = queryParams.bot;
  }

  if (queryParams.to_user) {
    query.to_user = queryParams.to_user;
  }

  return query;
};

// 获取所有交易记录
const getTransactions = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const transactions = await Transaction.find(query)
    .populate('bot')
    .populate('to_user')
    .sort('-createdAt') // Sort by creation time in descending order
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  res.json({
    success: true,
    data: transactions,
  });
});

// 根据 ID 获取交易记录
const getTransactionById = handleAsync(async (req: Request, res: Response) => {
  const transaction = await Transaction.findById(req.params.id).exec();

  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  res.json({
    success: true,
    data: transaction,
  });
});

// 添加新交易记录
const addTransaction = handleAsync(async (req: Request, res: Response) => {
  const newId = await IdGen.next(Transaction, 'id', 6);

  const newTransaction = new Transaction({
    ...req.body,
    id: newId,
  });

  const savedTransaction = await newTransaction.save();

  res.json({
    success: true,
    data: savedTransaction,
  });
});

// 更新交易记录
const updateTransaction = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedTransaction = await Transaction.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  ).exec();

  if (!updatedTransaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  res.json({
    success: true,
    data: updatedTransaction,
  });
});

// 删除交易记录
const deleteTransaction = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const transaction = await Transaction.findByIdAndDelete(id).exec();

  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  res.json({
    success: true,
    data: { message: 'Transaction deleted successfully' },
  });
});

// 批量删除交易记录
const deleteMultipleTransactions = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Transaction.deleteMany({
      _id: { $in: ids },
    }).exec();

    res.json({
      success: true,
      message: `${ids.length} transactions deleted successfully`,
    });
  },
);

export const getFilteredTransactions = handleAsync(
  async (req: Request, res: Response) => {
    const { type } = req.query;

    // Build query based on type parameter
    const query: any = {};
    if (type === 'exchange_rate') {
      query.exchange_rate = { $exists: true };
    } else if (type === 'fee_rate') {
      query.fee_rate = { $exists: true };
    } else {
      res.json({
        success: true,
        data: [],
      });
    }
    // Execute query with type filter
    const transactions = await Transaction.find(query)
      .sort('-createdAt')
      .lean()
      .exec();

    res.json({
      success: true,
      data: transactions,
    });
  },
);

export {
  getTransactions,
  getTransactionById,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  deleteMultipleTransactions,
};
