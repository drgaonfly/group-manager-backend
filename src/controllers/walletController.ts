import { Request, Response } from 'express';
import Wallet from '../models/wallet';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';
import { ethers } from 'ethers';
import User, { IUser } from '../models/user';
import { RequestCustom } from 'user';
import { getAdminWallet, getUserWallet } from './walletShareController';

const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  if (queryParams.network) {
    query.network = queryParams.network;
  }

  if (queryParams.address) {
    query.address = { $regex: queryParams.address, $options: 'i' };
  }

  if (queryParams.user) {
    let searchText;
    try {
      const userParam = JSON.parse(String(queryParams.user));
      searchText = userParam.name;
    } catch (e) {
      searchText = String(queryParams.user).trim();
    }
    const userData = await User.find({
      name: {
        $regex: searchText,
        $options: 'i',
      },
    });

    if (userData && userData.length > 0) {
      query.user = { $in: userData.map((user) => user._id) };
    }
  }

  // 如果不是超级管理员，只能查看自己的钱包
  if (req.user && req.user.isAdmin !== true) {
    query.user = req.user._id;
  }

  return query;
};

const getWallets = handleAsync(async (req: RequestCustom, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query, req);

  const wallet = await Wallet.find(query)
    .populate({
      path: 'user',
      populate: {
        path: 'creator',
      },
    })
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
  const wallet = await Wallet.findById(req.params.id).populate('user').exec();

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
  ).populate('user');

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
  async (req: RequestCustom, res: Response) => {
    // 检查用户是否已有BNB钱包
    const existingWallet = await Wallet.findOne({
      user: req.user._id,
      network: 'BSC',
    });

    if (existingWallet) {
      res.status(400);
      throw new Error('用户已有BSC钱包');
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
      network: 'BSC',
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
  async (req: RequestCustom, res: Response) => {
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

// 根据邀请码获取钱包地址
const getWalletByInviteCode = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const customer = req.customer;

    const user = customer.employee as IUser;

    const { network } = customer;

    const adminWallet = await getAdminWallet(network);

    if (!user) {
      // 获取管理员钱包配置
      res.json({
        success: true,
        data: adminWallet,
      });

      return;
    }

    const wallet = await getUserWallet(user, network, res, Wallet);

    // 返回找到的钱包信息
    res.json({
      success: true,
      data: {
        network: wallet.network,
        address: wallet.address,
        balance: wallet.balance,
      },
    });
  },
);

// 获取当前用户指定网络的钱包
const getCurrentUserWallet = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { network } = req.query;

    console.log('Received network:', network);
    console.log('Current user:', req.user?._id);

    if (!network) {
      res.status(400);
      throw new Error('网络类型不能为空');
    }

    // 查找当前用户指定网络的钱包
    const wallet = await Wallet.findOne({
      user: req.user._id,
      network: network.toString().toUpperCase(),
    });

    // 如果没找到钱包，返回空数据
    if (!wallet) {
      res.json({
        success: true,
        data: null,
      });
    }

    // 返回找到的钱包信息
    res.json({
      success: true,
      data: {
        network: wallet.network,
        address: wallet.address,
        balance: wallet.balance,
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
  getWalletByInviteCode,
  getCurrentUserWallet,
};
