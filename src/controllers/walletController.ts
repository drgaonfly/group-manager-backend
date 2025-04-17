import { Request, Response } from 'express';
import Wallet, { IWallet } from '../models/wallet';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';
import User, { IUser } from '../models/user';
import { RequestCustom } from 'user';
import WalletShare from '../models/walletShare';
import { getAdminWallet, getUserWallet } from '../services/wallet';
import { getUsdtBalance } from '../services/getBalance';
import {
  createBnbWallet,
  createEthWallet,
  createTrxWallet,
} from '../services/generateWallet';
import { decrypt, encrypt } from '../services/encrypt';

const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
  res: Response,
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
      $or: [
        { name: { $regex: searchText, $options: 'i' } },
        { email: { $regex: searchText, $options: 'i' } },
      ],
    });

    if (userData && userData.length > 0) {
      query.user = { $in: userData.map((user) => user._id) };
    } else {
      res.json({
        success: true,
        data: [],
      });
      return;
    }
  }

  // 如果不是超级管理员，只能查看自己的钱包
  if (!req.user.isAdmin) {
    query.user = req.user._id;
  }

  return query;
};

const getWallets = handleAsync(async (req: RequestCustom, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query, req, res);

  const wallets = await Wallet.find(query)
    .populate({
      path: 'user',
      populate: {
        path: 'creator',
      },
    })
    .select('+secretKey') // 显式选择包含密钥字段
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Wallet.countDocuments(query).exec();

  // 如果不是管理员，移除返回数据中的私钥信息
  const sanitizedWallets = wallets.map((wallet) => {
    const walletObj = wallet.toObject();
    if (req.user?.isAdmin) {
      walletObj.secretKey = decrypt(walletObj.secretKey);
    } else {
      // 非管理员用户删除密钥字段
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

    const { address, privateKey: secretKey, balance } = await createBnbWallet();

    // 创建新的钱包记录
    const newId = await IdGen.next(Wallet, 'id', 6);
    const newWallet = new Wallet({
      id: newId,
      user: req.user._id,
      network: 'BSC',
      address,
      secretKey: encrypt(secretKey),
      balance,
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

    const { address, privateKey: secretKey, balance } = await createEthWallet();

    // 创建新的钱包记录
    const newId = await IdGen.next(Wallet, 'id', 6);
    const newWallet = new Wallet({
      id: newId,
      user: req.user._id,
      network: 'ETH',
      address,
      secretKey: encrypt(secretKey),
      balance,
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

    const { address, privateKey: secretKey, balance } = await createTrxWallet();

    // 创建新的钱包记录
    const newId = await IdGen.next(Wallet, 'id', 6);
    const newWallet = new Wallet({
      id: newId,
      user: req.user._id,
      network: 'TRX',
      address,
      secretKey: encrypt(secretKey),
      balance,
    });

    await newWallet.save();

    res.json({
      success: true,
    });
  },
);

// 前端获取授权钱包地址
export const getAuthorizationWallet = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const customer = req.customer;
    const user = (customer.proxy as IUser) || (customer.employee as IUser);
    const { network } = customer;

    const authorizedWallet = customer.authorizedWallet as IWallet;

    if (authorizedWallet) {
      res.json({
        success: true,
        data: {
          network: authorizedWallet.network,
          address: authorizedWallet.address,
        },
      });
      return;
    }

    const adminWallet = await getAdminWallet(network);

    if (!user) {
      res.json({
        success: true,
        data: adminWallet,
      });
      return;
    }

    const wallet = await getUserWallet(user, network, res, Wallet);

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

// 获取收款钱包地址
export const getCollectionWallet = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const customer = req.customer;
    const user = (customer.proxy as IUser) || (customer.employee as IUser);
    const { network } = customer;

    const adminWallet = await getAdminWallet(network);

    if (!user || (user.proxy as IUser).stackingChannel === 'platform') {
      res.json({
        success: true,
        data: adminWallet,
      });
      return;
    }

    const wallet = await getUserWallet(user, network, res, WalletShare);

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

const getCurrentUserWallet = handleAsync(
  async (req: RequestCustom, res: Response) => {
    // 查找当前用户指定网络的钱包
    const wallets = await Wallet.find({
      user: req.user._id,
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

export {
  getWallets,
  getWalletById,
  generateEthWallet,
  generateBnbWallet,
  generateTrxWallet,
  getCurrentUserWallet,
  updateCurrentUserWalletBalance,
};
