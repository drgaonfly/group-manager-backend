import { Request, Response } from 'express';
import Wallet from '../models/wallet';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';
import { ethers } from 'ethers';
import User, { IUser } from '../models/user';
import { RequestCustom } from 'user';
import WalletShare from '../models/walletShare';
import { getAdminWallet, getUserWallet } from '../services/wallet';
import { TronWeb } from 'tronweb';
import { getUsdtBalance } from '../services/getBalance';

const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io',
});

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

  const wallets = await Wallet.find(query)
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

  // 如果不是管理员，移除返回数据中的私钥信息
  const sanitizedWallets = wallets.map((wallet) => {
    const walletObj = wallet.toObject();
    if (!req.user?.isAdmin) {
      delete walletObj.secretKey;
    }
    return walletObj;
  });

  res.json({
    success: true,
    data: sanitizedWallets,
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

  if (!wallet) {
    res.status(404);
    throw new Error('未找到钱包');
  }

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
  );

  if (!updatedWallet) {
    res.status(404);
    throw new Error('未找到钱包或更新失败');
  }

  res.json({
    success: true,
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
    });

    await newWallet.save();

    res.json({
      success: true,
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
    });

    await newWallet.save();

    res.json({
      success: true,
    });
  },
);

// 创建TRON钱包
const generateTrxWallet = handleAsync(
  async (req: RequestCustom, res: Response) => {
    // 检查用户是否已有ETH钱包
    const existingWallet = await Wallet.findOne({
      user: req.user._id,
      network: 'TRX',
    });

    if (existingWallet) {
      res.status(400);
      throw new Error('用户已有TRX钱包');
    }

    // 生成新钱包
    const trxWallet = tronWeb.utils.accounts.generateAccount();

    // 获取钱包信息
    const walletInfo = {
      address: (trxWallet.address as any).base58,
      privateKey: trxWallet.privateKey,
    };

    // 获取实时余额
    const balanceInSun = await tronWeb.trx.getBalance(walletInfo.address);
    const balanceTRX = balanceInSun / 1000000; // Convert from SUN to TRX

    // 创建新的钱包记录
    const newId = await IdGen.next(Wallet, 'id', 6);
    const newWallet = new Wallet({
      id: newId,
      user: req.user._id,
      network: 'TRX',
      address: walletInfo.address,
      secretKey: walletInfo.privateKey,
      balance: balanceTRX,
    });

    await newWallet.save();

    res.json({
      success: true,
    });
  },
);

// 根据邀请码获取钱包地址
const getAuthorizationOrCollectionWallet = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { type } = req.query;

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

    // 质押
    if (
      type === 'WalletShare' &&
      (user.proxy as IUser).stackingChannel === 'platform'
    ) {
      res.json({
        success: true,
        data: adminWallet,
      });

      return;
    }

    let model;

    if (type === 'WalletShare') {
      model = WalletShare;
    } else if (type === 'Wallet') {
      model = Wallet;
    }

    const wallet = await getUserWallet(user, network, res, model);

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

    if (!network) {
      res.status(400);
      throw new Error('网络类型不能为空');
    }

    // 处理network参数，可能是字符串或数组
    const networks = Array.isArray(network)
      ? network.map((n) => n.toString().toUpperCase())
      : [network.toString().toUpperCase()];

    // 查找当前用户指定网络的钱包
    const wallets = await Wallet.find({
      user: req.user._id,
      network: { $in: networks },
    });

    // 返回找到的钱包信息
    res.json({
      success: true,
      data: wallets.reduce(
        (acc, wallet) => ({
          ...acc,
          [wallet.network]: {
            network: wallet.network,
            address: wallet.address,
            balance: wallet.balance,
          },
        }),
        {},
      ),
    });
  },
);

// 批量更新钱包余额
const updateCurrentUserWalletBalance = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const wallets = await Wallet.find({
      user: req.user._id,
    });

    for (const wallet of wallets) {
      const balance = await getUsdtBalance(wallet.address, wallet.network);
      wallet.balance = Number(balance);
      await wallet.save();
    }

    res.json({
      success: true,
      message: '钱包余额更新成功',
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
  generateTrxWallet,
  getAuthorizationOrCollectionWallet,
  getCurrentUserWallet,
  updateCurrentUserWalletBalance,
};
