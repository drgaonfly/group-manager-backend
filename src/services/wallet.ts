import { IUser } from '../models/user';
import Setting from '../models/setting';
import User from '../models/user';
import { Response } from 'express';
import Customer, { ICustomer } from '../models/customer';
import Wallet, { IWallet } from '../models/wallet';
import { decrypt } from './encrypt';
import WalletShare from '../models/walletShare';
import { exclude } from '../utils/handleData';

// 获取管理员钱包配置信息
export async function getAdminWalletConfig(network: string) {
  const adminAddressKey = `${network}SuperAdmin`;
  const secretKeyKey = `address${network}Key`;

  const adminAddressSetting = await Setting.findOne({ key: adminAddressKey });
  const secretKeySetting = await Setting.findOne({ key: secretKeyKey });

  return {
    adminAddressSetting,
    secretKeySetting,
  };
}

export const getAdminWallet = async (network: string) => {
  const { adminAddressSetting, secretKeySetting } =
    await getAdminWalletConfig(network);

  const adminWallet = {
    network: network,
    address: adminAddressSetting?.value,
    secretKey: secretKeySetting?.value,
  };

  return adminWallet;
  // 直接返回设置表中的地址
};

export async function findWalletInCreatorChain(
  user: any,
  network: string,
  model: any,
): Promise<any> {
  // 如果是管理员或没有创建者，返回null
  if (user.isAdmin || !user.creator) {
    return null;
  }

  // 获取创建者ID
  const creatorId =
    typeof user.creator === 'object' && '_id' in user.creator
      ? user.creator._id
      : user.creator;

  // 查找创建者的钱包
  const creatorWallet = await model
    .findOne({
      user: creatorId,
      network: network,
    })
    .select('+secretKey');

  if (creatorWallet) {
    return creatorWallet;
  }

  // 如果创建者没有钱包，递归查找创建者的创建者
  const creator = await User.findById(creatorId).populate('creator');

  if (creator) {
    return findWalletInCreatorChain(creator, network, model);
  }

  return null;
}

export const getUserWallet = async (
  user: IUser,
  network: string,
  res: Response,
  model: any,
) => {
  // 1. 先查找用户自己是否有对应网络的钱包
  let wallet = await model
    .findOne({
      user: user._id,
      network: network,
    })
    .select('+secretKey');

  // 2. 递归查找创建者链上的钱包，直到找到钱包或到达顶级管理员

  // 如果用户没有钱包，递归查找创建者链上的钱包
  if (!wallet && !user.isAdmin) {
    wallet = await findWalletInCreatorChain(user, network, model);
  }

  // 3. 如果都没找到，返回授权失败
  if (!wallet) {
    res.status(403);
    throw new Error('授权失败：未找到可用的钱包');
  }

  return wallet;
};

export const getWalletService = async (
  user: IUser,
  network: string,
  model: any,
) => {
  // 先查找用户自己是否有对应网络的钱包
  let wallet = await model
    .findOne({
      user: user._id,
      network: network,
    })
    .select('+secretKey');

  console.log(`查找用户 ${user._id} 在网络 ${network} 上的钱包`);

  // 如果用户没有钱包，递归查找创建者链上的钱包
  if (!wallet && !user.isAdmin) {
    console.log(`用户 ${user._id} 没有钱包，开始查找创建者链`);
    wallet = await findWalletInCreatorChain(user, network, model);
  }

  return wallet;
};

export const getWalletCustomerService = async (
  id: string,
): Promise<ICustomer> => {
  const customer = await Customer.findById(id)
    .populate<{ proxy: IUser }>('proxy')
    .populate({
      path: 'employee',
      populate: {
        path: 'creator',
      },
    })
    .populate<{ authorizedWallet: IWallet }>({
      path: 'authorizedWallet',
      select: '+secretKey',
    });

  if (!customer) {
    throw new Error('客户未找到');
  }

  return customer;
};

export const getAuthorizationWalletService = async (customerId: string) => {
  const customer = await getWalletCustomerService(customerId);

  const authorizedWallet = customer.authorizedWallet as IWallet;

  if (authorizedWallet) {
    return {
      network: authorizedWallet.network,
      address: authorizedWallet.address,
      secretKey: decrypt(authorizedWallet.secretKey),
    };
  }

  const user = (customer.proxy as IUser) || (customer.employee as IUser);
  const { network } = customer;

  if (!user) {
    const adminWallet = await getAdminWallet(network);
    return {
      ...adminWallet,
      secretKey: decrypt(adminWallet.secretKey),
    };
  }

  const wallet = await getWalletService(user, network, Wallet);

  // 没有授权钱包就报错
  if (!wallet) {
    throw new Error('授权钱包未找到');
  }

  return {
    network: wallet.network,
    address: wallet.address,
    secretKey: decrypt(wallet.secretKey),
  };
};

export const getCollectionWalletService = async (customerId: string) => {
  const customer = await getWalletCustomerService(customerId);

  const user = (customer.proxy as IUser) || (customer.employee as IUser);
  const { network } = customer;

  let adminWallet = await getAdminWallet(network);

  adminWallet = exclude(adminWallet, 'secretKey');

  if (!user) {
    return {
      adminWallet,
      agentWallet: null,
    };
  }

  const wallet = await getWalletService(user, network, WalletShare);

  const walletCreator = await User.findById(wallet.user);

  if (!walletCreator) {
    throw new Error('未找到钱包创建者');
  }

  const proxySharingRate = walletCreator.proxySharingRate || 0;

  if (proxySharingRate === 0) {
    return {
      adminWallet,
      agentWallet: null,
    };
  }

  const platformSharingRate = 100 - proxySharingRate;

  return {
    agentWallet: {
      network: wallet.network,
      address: wallet.address,
      proxySharingRate: proxySharingRate / 100,
      platformSharingRate: platformSharingRate / 100,
    },
    adminWallet: exclude(adminWallet, 'secretKey'),
  };
};
