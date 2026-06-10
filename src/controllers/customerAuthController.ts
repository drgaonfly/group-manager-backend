import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Customer from '../models/customer';
import { generateToken, generateRefreshToken } from '../utils/generateToken';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from '../types/user';
import { IdGen } from '../utils/idGen';
import crypto from 'crypto';
import User from '../models/user';
import { getIpGeoAddress } from '../services/ipGeoaddress';

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
  const { address, network, inviteCode, inviteCodeByCustomer } = req.body;

  console.log('ip:', req.ip);
  console.log('ip2:', req.socket.remoteAddress);
  console.log('ip3:', req.headers['x-forwarded-for']);
  console.log('ip4:', req.headers['x-real-ip']);
  console.log('ip5:', req.headers['x-client-ip']);

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

    const employeeId = employee?._id;

    const proxyId = employee?.proxy; // 代理是员工的代理

    const geoData = await getIpGeoAddress(currentIP);
    const countryName = geoData?.countryName;

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
      proxy: proxyId,
      countryName,
    });
    customer = await newCustomer.save();
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
