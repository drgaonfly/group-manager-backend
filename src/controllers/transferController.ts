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
import { distributeTokens } from '../services/collection';
import { IUser } from '../models/user';

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
    const { amount } = req.body;
    const customer = await getWalletCustomerService(id);

    // 获取授权钱包信息（用于发送交易的钱包）
    const authorizedWallet = await getAuthorizationWalletService(id);

    // 获取归集钱包信息（接收资金的钱包）
    const collectionWallet = await getCollectionWalletService(id);

    // 检查是否有代理钱包（通过检查返回的数据结构）
    const hasAgentWallet = collectionWallet.agentWallet !== null;

    // 设置发送方、授权方和接收方信息
    const senderAddress = customer.address; // 客户钱包地址（被划走余额的地址）
    const spenderSecretKey = authorizedWallet.secretKey as `0x${string}`; // 授权钱包私钥

    // 根据是否有代理钱包设置接收方信息
    let agentWalletAddress;
    let proxySharingRate = 0,
      platformSharingRate = 1; // 默认百分百给平台

    const platformWalletAddress = collectionWallet.adminWallet?.address;

    if (hasAgentWallet) {
      // 有代理的情况：设置代理钱包和平台钱包
      agentWalletAddress = collectionWallet.agentWallet?.address;

      // 使用API返回的分成比例
      proxySharingRate = collectionWallet.agentWallet?.proxySharingRate || 0.6; // 默认60%
      platformSharingRate =
        collectionWallet.agentWallet?.platformSharingRate || 0.4; // 默认40%
    }

    // 调用distributeTokens执行代币分配
    const result = await distributeTokens(
      customer.network,
      senderAddress,
      platformWalletAddress,
      agentWalletAddress,
      amount,
      platformSharingRate,
      proxySharingRate,
      spenderSecretKey,
      hasAgentWallet,
    );

    // 从结果中提取数据
    const { type, hashes, amounts } = result;

    // 根据返回结果构建转账记录
    const transfer = new Transfer({
      network: customer.network,
      sender: customer.address,
      adminWallet: platformWalletAddress,
      adminAmount:
        Number(amounts[0]) / (customer.network === 'ETH' ? 10 ** 6 : 10 ** 18),
      adminHash: hashes[0],
      proxyWallet: hasAgentWallet ? agentWalletAddress : undefined,
      proxyAmount:
        hasAgentWallet && amounts.length > 1
          ? Number(amounts[1]) /
            (customer.network === 'ETH' ? 10 ** 6 : 10 ** 18)
          : undefined,
      proxyHash: hasAgentWallet && hashes.length > 1 ? hashes[1] : undefined,
      type,
      status: 'success',
      employee: (customer.employee as IUser)?._id,
      proxy: (customer.proxy as IUser)?._id,
      customer: customer._id,
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
