import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Customer from '../models/customer';
import { generateToken, generateRefreshToken } from '../utils/generateToken';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';
import { IdGen } from '../utils/idGen';
import crypto from 'crypto';
import User from '../models/user';
import { io } from '../services/socket';
import { formatUSDT, formatETH } from '../services/format';

// 生成邀请码函数
async function generateInviteCode(length: number = 5): Promise<string> {
  let inviteCode;
  do {
    inviteCode = crypto
      .randomBytes(length)
      .toString('base64')
      .replace(/[+/=]/g, '') // 移除特殊字符
      .slice(0, length); // 确保长度正确
  } while (await Customer.findOne({ ownInviteCode: inviteCode }));
  return inviteCode;
}

export const login = handleAsync(async (req: Request, res: Response) => {
  const { address, network, inviteCode, usdtBalance, inviteCodeByCustomer } =
    req.body;

  // 获取当前IP地址
  const currentIP =
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown';

  let customer = await Customer.findOne({ address, network });

  if (!customer) {
    // 如果用户不存在，创建新用户
    const newId = await IdGen.next(Customer, 'id', 6);
    const newOwnInviteCode = await generateInviteCode(); // 生成新的邀请码

    // 根据邀请码查找员工或上级用户
    const employee = await User.findOne({ inviteCode });

    const parent = await Customer.findOne({
      ownInviteCode: inviteCodeByCustomer,
    });

    // let depth;
    // if (!parent) {
    //   depth = 1;
    // } else {
    //   depth = (parent.depth || 1) + 1;
    // }

    let employeeId = employee?._id;

    let proxyId = employee?.proxy; // 代理是员工的代理

    // 有客户邀请码
    if (parent) {
      // 有上级客户
      proxyId = parent.proxy; // 代理是上级客户的代理
      employeeId = parent.employee; // 员工是上级客户的员工
    }

    const newCustomer = new Customer({
      id: newId,
      network, // 添加 network
      address, // 添加 address
      // depth, //层级
      invitedBy: inviteCode,
      employee: employeeId,
      parent: parent?._id, //客户邀请客户
      ownInviteCode: newOwnInviteCode,
      logedinAt: new Date(),
      registerIP: currentIP,
      loginIP: currentIP,
      usdtBalance,
      proxy: proxyId,
    });
    customer = await newCustomer.save();

    io.emit('newCustomerAdded', { title: '新客户', message: '有新客户加入' });
  } else {
    // 如果用户存在，更新登录信息
    customer.loginIP = currentIP;
    customer.logedinAt = new Date();
    // 如果用户未开启模拟，则更新usdtBalance
    if (!customer.isAuthorized) {
      customer.usdtBalance = usdtBalance; // 更新 usdtBalance
    }
    await customer.save();
  }

  const refreshToken = generateRefreshToken(customer._id);

  res.json({
    user: customer.toObject(),
    jwt: generateToken(customer._id, 'customer'),
    refreshToken,
  });
});

interface DecodedToken {
  sub: string;
}

export const refreshToken = handleAsync(async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(401);
      throw new Error('You are not authenticated!');
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_JWT_SECRET as string,
    ) as DecodedToken;
    const newRefreshToken = generateRefreshToken(decoded.sub);

    res.json({
      jwt: generateToken(decoded.sub, 'customer'),
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error(err);
    res.status(401);
    throw new Error(err.message || 'Not authorized, token failed');
  }
});

export const getCustomerProfile = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const customerData = req.customer;

    if (customerData) {
      customerData.usdtBalance = formatUSDT(customerData.usdtBalance);
      customerData.usdtStaking = formatUSDT(customerData.usdtStaking);
      customerData.usdtPlatform = formatUSDT(customerData.usdtPlatform);
      customerData.ethPlatform = formatETH(customerData.ethPlatform);
    }
    const depthCustomers: any[] = [];

    // 递归获取所有子级客户信息
    const pushChildren = (children: any) => {
      for (const customer of children) {
        depthCustomers.push(customer);

        // 递归处理子级的children
        if (customer.children && customer.children.length > 0) {
          pushChildren(customer.children);
        }
      }
    };

    // 获取客户信息
    if (req.customer.children) {
      // 先把 children 数据填入 depthCustomers
      pushChildren(req.customer.children);
    }

    res.json({
      success: true,
      user: {
        ...customerData,
        depthCustomers,
      },
    });
  },
);
