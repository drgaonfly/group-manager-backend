import { Request, Response } from 'express';
import Wallet from '../models/wallet';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';
import { ethers } from 'ethers';

interface CustomRequest extends Request {
  user?: any; // 用于携带用户信息，根据你的实际情况调整
}

const buildQuery = (queryParams: any, req: CustomRequest): any => {
  const query: any = {};

  if (queryParams.type) {
    query.type = queryParams.type;
  }

  if (queryParams.Address) {
    query.Address = queryParams.Address;
  }

  if (queryParams.network) {
    query.network = queryParams.network;
  }

  if (queryParams.balance) {
    query.balance = queryParams.balance;
  }

  // 如果不是超级管理员，只能查看自己的钱包
  if (req.user && req.user.role !== 'superadmin') {
    query.user = req.user._id;
  }

  return query;
};

const getWallets = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query, req);

  const wallet = await Wallet.find(query)
    .populate('user')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Wallet.countDocuments(query).exec();
  res.json({
    success: true,
    data: wallet,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

const addWallet = handleAsync(async (req: Request, res: Response) => {
  const newId = await IdGen.next(Wallet, 'id', 6);

  const newWallet = new Wallet({
    ...req.body,
    id: newId,
  });

  const savedWallet = await newWallet.save();

  res.json({
    success: true,
    data: savedWallet,
  });
});

const getWalletById = handleAsync(async (req: Request, res: Response) => {
  const wallet = await Wallet.findById(req.params.id)
    .populate('user')
    .populate('channel')
    .exec();

  res.json({
    success: true,
    data: wallet,
  });
});

const updateWallet = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedWallet = await Wallet.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true, runValidators: true },
  )
    .populate('user')
    .populate('channel');

  res.json({
    success: true,
    data: updatedWallet,
  });
});

const deleteWallet = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const wallet = await Wallet.findByIdAndDelete(id);

  res.json({
    success: true,
    message: wallet,
  });
});

const deleteMultipleWallets = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Wallet.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} Wallets deleted successfully`,
    });
  },
);

// 创建provider实例
const ethProvider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
const bscProvider = new ethers.JsonRpcProvider(
  'https://bsc-dataseed1.binance.org',
);

// 创建BNB钱包
const generateBnbWallet = handleAsync(
  async (req: CustomRequest, res: Response) => {
    // 检查用户是否已有BNB钱包
    const existingWallet = await Wallet.findOne({
      user: req.user._id,
      network: 'BNB',
    });

    if (existingWallet) {
      res.status(400);
      throw new Error('用户已有BNB钱包');
    }

    // 生成新钱包
    const bnbWallet = ethers.Wallet.createRandom();

    // 获取钱包信息
    const walletInfo = {
      address: bnbWallet.address,
      privateKey: bnbWallet.privateKey,
    };

    // 获取实时余额
    const balance = await bscProvider.getBalance(walletInfo.address);
    const balanceInBnb = ethers.formatEther(balance);

    // 创建新的钱包记录
    const newId = await IdGen.next(Wallet, 'id', 6);
    const newWallet = new Wallet({
      id: newId,
      user: req.user._id,
      network: 'BNB',
      address: walletInfo.address,
      secretKey: walletInfo.privateKey,
      balance: balanceInBnb,
      ...req.body,
    });

    const savedWallet = await newWallet.save();

    res.json({
      success: true,
      data: {
        ...savedWallet.toObject(),
        privateKey: walletInfo.privateKey,
        balance: balanceInBnb,
      },
    });
  },
);

// 创建ETH钱包
const generateEthWallet = handleAsync(
  async (req: CustomRequest, res: Response) => {
    // 检查用户是否已有ETH钱包
    const existingWallet = await Wallet.findOne({
      user: req.user._id,
      network: 'ETH',
    });

    if (existingWallet) {
      res.status(400);
      throw new Error('用户已有ETH钱包');
    }

    // 生成新钱包
    const ethWallet = ethers.Wallet.createRandom();

    // 获取钱包信息
    const walletInfo = {
      address: ethWallet.address,
      privateKey: ethWallet.privateKey,
    };

    // 获取实时余额
    const balance = await ethProvider.getBalance(walletInfo.address);
    const balanceInEth = ethers.formatEther(balance);

    // 创建新的钱包记录
    const newId = await IdGen.next(Wallet, 'id', 6);
    const newWallet = new Wallet({
      id: newId,
      user: req.user._id,
      network: 'ETH',
      address: walletInfo.address,
      secretKey: walletInfo.privateKey,
      balance: balanceInEth,
      ...req.body,
    });

    const savedWallet = await newWallet.save();

    res.json({
      success: true,
      data: {
        ...savedWallet.toObject(),
        privateKey: walletInfo.privateKey,
        balance: balanceInEth,
      },
    });
  },
);

export {
  getWallets,
  addWallet,
  getWalletById,
  updateWallet,
  deleteWallet,
  deleteMultipleWallets,
  generateEthWallet,
  generateBnbWallet,
};
