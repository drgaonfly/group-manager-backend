import { Request, Response } from 'express';
import Customer from '../models/customer';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';
import { IdGen } from '../utils/idGen';
import User from '../models/user';
import Wallet from '../models/wallet';
import Setting from '../models/setting';
import { isProxy } from '../middlewares/authMiddleware';
import WalletShare from '../models/walletShare';
const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  console.log('Received query params:', queryParams); // 添加日志

  if (queryParams.network) {
    query.network = queryParams.network;
  }

  if (queryParams.isVerified !== undefined) {
    query.isVerified = queryParams.isVerified === 'true';
  }

  if (queryParams.isAuthorized !== undefined) {
    query.isAuthorized = queryParams.isAuthorized === 'true';
  }

  if (queryParams.address) {
    query.address = queryParams.address;
  }

  if (isProxy(req.user)) {
    const employees = await User.find({ proxy: req.user._id });
    const employeeIds = employees.map((employee) => employee._id);
    query.employee = { $in: [...employeeIds, req.user._id] };
  }

  console.log('Built query:', query); // 添加日志
  return query;
};

// 获取成员列表
export const getCustomers = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = await buildQuery(req.query, req);
    console.log('Final query:', query);

    // 添加这个日志来查看实际查询结果的内容
    const members = await Customer.find(query)
      .populate('employee')
      .sort('-createdAt')
      .limit(+pageSize)
      .skip((+current - 1) * +pageSize)
      .exec();

    console.log(
      'Actual results:',
      members.map((m) => ({
        id: m.id,
        network: m.network,
      })),
    ); // 添加详细日志

    const total = await Customer.countDocuments(query);

    res.json({
      success: true,
      data: members,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

export const addCustomer = handleAsync(
  async (req: RequestCustom, res: Response) => {
    // 查找是否存在相同地址的成员
    const existingMember = await Customer.findOne({
      address: req.body.address,
    });

    // 获取当前IP地址
    const currentIP =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown';

    if (existingMember) {
      // 如果成员已存在，更新登录时间和登录IP并返回现有成员信息
      const updatedMember = await Customer.findByIdAndUpdate(
        existingMember._id,
        {
          logedinAt: new Date(),
          loginIP: currentIP,
          // 可以在这里更新其他需要更新的字段
        },
        { new: true },
      )
        .populate('channel')
        .populate('proxy');

      res.json({
        success: true,
        data: updatedMember,
        // isNewMember: false, // 标记这是现有成员
      });
      return;
    }

    // 如果成员不存在，创建新成员
    const newId = await IdGen.next(Customer, 'id', 6);

    const newMember = new Customer({
      ...req.body,
      id: newId,
      createdAt: new Date(),
      logedinAt: new Date(),
      registerIP: currentIP,
      loginIP: currentIP,
    });

    const savedMember = await newMember.save();

    // 返回新创建的成员信息
    res.status(201).json({
      success: true,
      data: savedMember,
      // isNewMember: true, // 标记这是新成员
    });
  },
);

// 获取单个成员
export const getCustomerById = handleAsync(
  async (req: Request, res: Response) => {
    const customer = await Customer.findById(req.params.id)
      .populate('channel')
      .populate('proxy');

    if (!customer) {
      res.status(404);
      throw new Error('Customer not found');
    }

    res.json({
      success: true,
      data: customer,
    });
  },
);

// 更新成员
export const updateCustomer = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    const customer = await Customer.findById(id);

    if (!customer) {
      res.status(404);
      throw new Error('成员未找到');
    }

    // 检查 isAuthorized 和 isVerified 不能同时为 true
    if (
      (updateData.isVerified === true && customer.isAuthorized === true) ||
      (updateData.isAuthorized === true && customer.isVerified === true) ||
      (updateData.isVerified === true && updateData.isAuthorized === true)
    ) {
      res.status(400);
      throw new Error('授权账户和模拟账户不能同时存在');
    }

    // 如果更新登录信息
    if (updateData.logedinAt) {
      updateData.LogedinIP =
        req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
        req.socket.remoteAddress ||
        'unknown';
    }

    const updatedMember = await Customer.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    res.json({
      success: true,
      data: updatedMember,
    });
  },
);

// 删除成员
export const deleteCustomer = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const customer = await Customer.findByIdAndDelete(id);

    if (!customer) {
      res.status(404);
      throw new Error('成员未找到');
    }

    res.json({
      success: true,
      data: { message: 'Customer deleted successfully' },
    });
  },
);

// 批量删除成员
export const deleteMultipleCustomers = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Customer.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} customers deleted successfully`,
    });
  },
);

export const verifyCustomer = handleAsync(
  async (req: Request, res: Response) => {
    const { network, address } = req.body;

    // 检查是否存在具有相同网络和地址组合的客户
    const existingCustomer = await Customer.findOne({ network, address });

    if (!existingCustomer) {
      res.status(404);
      throw new Error('Customer not found');
    }

    // 更新验证状态
    existingCustomer.isVerified = true;
    await existingCustomer.save();

    res.json({
      success: true,
      data: existingCustomer,
    });
  },
);

// customer返回用户归集钱包信息
export const getCustomerWalletByInviteCode = handleAsync(
  async (req: Request, res: Response) => {
    const { inviteCode, network, address } = req.query;

    console.log('Wallet request params:', { inviteCode, network, address });

    if (!network) {
      res.status(400);
      throw new Error('customer网络类型不能为空');
    }

    // 从设置表中获取超级管理员地址和密钥（无论是否有邀请码，都需要获取）
    const adminAddressKey = `${network}SuperAdmin`;
    const secretKeyKey = `address${network}Key`;

    const [adminAddressSetting, secretKeySetting] = await Promise.all([
      Setting.findOne({ key: adminAddressKey }),
      Setting.findOne({ key: secretKeyKey }),
    ]);

    if (!adminAddressSetting || !secretKeySetting) {
      res.status(404);
      throw new Error(`未找到${network}网络的管理员钱包配置`);
    }

    // 管理员钱包信息
    const adminWallet = {
      network: network,
      address: adminAddressSetting.value,
      secretKey: secretKeySetting.value,
      balance: '0',
    };

    let user;
    if (!inviteCode) {
      // 如果没有邀请码，直接返回管理员钱包信息
      res.json({
        success: true,
        data: adminWallet,
      });
      return;
    } else {
      // 根据邀请码查找用户，同时关联查询创建者信息
      user = await User.findOne({ inviteCode }).populate('creator');
    }

    if (!user) {
      res.status(404);
      throw new Error('未找到用户');
    }

    // 1. 先查找用户自己是否有对应网络的钱包
    let wallet = await Wallet.findOne({
      user: user._id,
      network: network,
    });

    // 2. 递归查找创建者链上的钱包，直到找到钱包或到达顶级管理员
    async function findWalletInCreatorChain(currentUser: any): Promise<any> {
      // 如果是管理员或没有创建者，返回null
      if (currentUser.isAdmin || !currentUser.creator) {
        return null;
      }

      // 获取创建者ID
      const creatorId =
        typeof currentUser.creator === 'object' && '_id' in currentUser.creator
          ? currentUser.creator._id
          : currentUser.creator;

      // 查找创建者的钱包
      const creatorWallet = await WalletShare.findOne({
        user: creatorId,
        network: network,
      });

      if (creatorWallet) {
        return creatorWallet;
      }

      // 如果创建者没有钱包，递归查找创建者的创建者
      const creator = await User.findById(creatorId).populate('creator');
      if (creator) {
        return findWalletInCreatorChain(creator);
      }
      return null;
    }

    // 如果用户没有钱包，递归查找创建者链上的钱包
    if (!wallet && !user.isAdmin) {
      wallet = await findWalletInCreatorChain(user);
    }

    // 3. 如果都没找到，返回授权失败
    if (!wallet) {
      res.status(403);
      throw new Error('授权失败：未找到可用的钱包');
    }

    // 获取钱包创建者的分润比例
    const walletCreator = await User.findById(wallet.user);
    if (!walletCreator) {
      res.status(404);
      throw new Error('未找到钱包创建者');
    }

    // 获取代理的分润比例（如果没有设置则为0）
    const proxySharingRate = walletCreator.proxySharingRate || 0;

    //获取平台分润比例
    const platformSharingRate = 100 - proxySharingRate;

    // 返回用户钱包信息、管理员钱包信息以及分润比例
    res.json({
      success: true,
      data: {
        // 用户/代理钱包信息
        agentWallet: {
          network: wallet.network,
          address: wallet.address,
          // secretKey: wallet.secretKey,
          // balance: wallet.balance || '0',
          proxySharingRate: proxySharingRate / 100, // 代理分润比例
          platformSharingRate: platformSharingRate / 100, // 平台分润比例
        },
        // 管理员钱包信息
        adminWallet: adminWallet,
      },
    });
  },
);
