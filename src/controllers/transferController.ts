import { Request, Response } from 'express';
import Transfer from '../models/transfer';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';
import { queryByProxy } from './withdrawController';
import {
  getAuthorizationWalletService,
  getCollectionWalletService,
  getWalletCustomerService,
} from '../services/wallet';

// Helper function to build query
const buildTransferQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  if (queryParams.type) {
    query.type = queryParams.type;
  }

  if (queryParams.address) {
    query.address = {
      $regex: queryParams.address,
      $options: 'i',
    };
  }

  // sender
  if (queryParams.sender) {
    query.sender = {
      $regex: queryParams.sender,
      $options: 'i',
    };
  }

  // adminWallet
  if (queryParams.adminWallet) {
    query.adminWallet = {
      $regex: queryParams.adminWallet,
      $options: 'i',
    };
  }

  // proxyWallet
  if (queryParams.proxyWallet) {
    query.proxyWallet = {
      $regex: queryParams.proxyWallet,
      $options: 'i',
    };
  }

  // adminHash
  if (queryParams.adminHash) {
    query.adminHash = {
      $regex: queryParams.adminHash,
      $options: 'i',
    };
  }

  // proxyHash
  if (queryParams.proxyHash) {
    query.proxyHash = {
      $regex: queryParams.proxyHash,
      $options: 'i',
    };
  }

  await queryByProxy(query, req);

  return query;
};

// Get all transfers
const getTransfers = handleAsync(async (req: RequestCustom, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildTransferQuery(req.query, req);

  const transfers = await Transfer.find(query)
    .populate('employee')
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
  const transfer = await Transfer.findById(req.params.id);

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
  );

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

// 1. 直接转账 (direct): 用户直接转账给平台
// 2. 代理转账 (agent): 用户先转账给代理，代理再转账给平台
const addCollectionTransfer = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { id } = req.params;
    const customer = await getWalletCustomerService(id);

    const authorizedWallet = await getAuthorizationWalletService(id);

    const collectionWallet = await getCollectionWalletService(id);

    const {
      adminWallet, // 平台接收地址
      adminAmount, // 平台接收金额
      adminHash, // 平台交易哈希
      proxyWallet, // 代理接收地址（可选）
      proxyAmount, // 代理接收金额（可选）
      proxyHash, // 代理交易哈希（可选）
      type, // 转账类型：direct 或 agent
      employee, // 员工
    } = req.body;

    // 创建转账记录
    const transfer = new Transfer({
      network: customer.network,
      sender: customer.address,
      adminWallet,
      adminAmount: Number(adminAmount),
      adminHash,
      proxyWallet,
      proxyAmount: proxyAmount ? Number(proxyAmount) : undefined,
      proxyHash,
      type,
      status: 'success',
      employee: employee === '' ? undefined : employee,
    });

    // 保存转账记录
    const savedTransfer = await transfer.save();

    res.json({
      success: true,
      data: savedTransfer,
      message: '收款转账记录创建成功',
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
  addCollectionTransfer,
};
