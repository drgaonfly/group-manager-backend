// controllers/userController.ts
import { Request, Response } from 'express';
import User from '../models/user';
import handleAsync from '../utils/handleAsync';
import bcrypt from 'bcrypt';
import { exclude } from '../utils/handleData';
import { RequestCustom } from 'user';
import crypto from 'crypto';
import { isProxy } from '../middlewares/authMiddleware';
import Role from '../models/role';
import Wallet from '../models/wallet';
import { IdGen } from '../utils/idGen';
import LoginHistory from '../models/loginHistory';
import Channel from '../models/channel';

//user
async function generateInviteCode(length: number = 5): Promise<string> {
  let inviteCode;
  do {
    inviteCode = crypto
      .randomBytes(length)
      .toString('base64')
      .replace(/[+/=]/g, '') // 移除特殊字符
      .slice(0, length); // 确保长度正确
  } while (await User.findOne({ inviteCode }));
  return inviteCode;
}

export const getUsers = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const {
      email,
      name,
      live,
      inviteCode,
      current = '1',
      pageSize = '10',
      stats, // 新增参数，用于控制是否返回统计数据
    } = req.query;

    if (stats === 'true') {
      // 执行统计逻辑
      const { startDate, endDate } = req.query;

      const start = startDate
        ? new Date(startDate as string)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid date range provided',
        });
        return;
      }

      const stats = await User.aggregate([
        {
          $match: {
            createdAt: {
              $gte: start,
              $lte: end,
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }, // 按日期分组
            },
            count: { $sum: 1 }, // 统计注册用户数量
          },
        },
        {
          $sort: { _id: 1 }, // 按日期排序
        },
      ]);

      res.json({
        success: true,
        data: stats.map((item) => ({
          date: item._id,
          count: item.count,
        })),
      });

      return;
    }

    // 默认用户查询逻辑
    const query: any = {};

    if (email) {
      query.email = email;
    }

    if (inviteCode) {
      query.inviteCode = inviteCode;
    }

    if (name) {
      query.name = { $regex: name, $options: 'i' };
    }

    if (live) {
      query.live = live === 'true';
    }

    if (
      req.baseUrl + req.route.path === '/api/employees/' &&
      isProxy(req.user) &&
      !req.getAllData
    ) {
      query.proxy = req.user._id;
    }

    if (req.baseUrl + req.route.path === '/api/employees/') {
      const employeeRole = await Role.findOne({ name: '员工' });
      query.roles = [employeeRole?._id];
    }

    if (req.baseUrl + req.route.path === '/api/proxies/') {
      const proxyRole = await Role.findOne({ name: '代理' });
      query.roles = [proxyRole?._id];
    }

    if (req.baseUrl + req.route.path === '/api/customers/') {
      const customerRole = await Role.findOne({ name: '客户' });
      query.roles = [customerRole?._id];
    }

    if (req.baseUrl + req.route.path === '/api/members/') {
      const memberRole = await Role.findOne({ name: '会员' });
      query.roles = [memberRole?._id];
    }

    const users = await User.find(query)
      .populate('roles')
      .populate('proxy') // 加载代理信息
      .sort('-createdAt') // 按创建时间降序排序
      .limit(+pageSize)
      .skip((+current - 1) * +pageSize)
      .exec();

    // 获取每个用户的最后登录时间，并填充到用户数据中
    const usersWithWallets = await Promise.all(
      users.map(async (user) => {
        const wallets = await Wallet.find({ user: user._id });
        const channel = await Channel.find({ user: user._id });

        // 获取用户的最后登录记录
        const lastLogin = await LoginHistory.findOne({ userId: user.id }).sort({
          loginAt: -1,
        });

        const clientIP =
          req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || // 代理服务器传递的真实 IP
          req.socket.remoteAddress || // 从 socket 获取的 IP 地址
          'unknown';

        const normalizedIP =
          clientIP === '::1' || clientIP === ':::1' ? '127.0.0.1' : clientIP;

        const logedinAt = new Date();

        // 将钱包与用户信息合并
        return {
          ...exclude(user.toObject(), 'password'),
          wallets: wallets.length > 0 ? wallets : null, // 仅取第一个钱包
          channel: channel[0],
          lastLoginAt: lastLogin ? lastLogin.loginAt : null, // 填充 lastLoginAt
          LogedinIP: normalizedIP,
          logedinAt: logedinAt,
        };
      }),
    );

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: usersWithWallets,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

export const addUser = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const userExists = await User.findOne({ email: req.body.email });

    if (userExists) {
      res.status(400);
      throw new Error('用户已存在');
    }

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(req.body.password, salt);

    const inviteCode = await generateInviteCode();

    let proxy;

    if (req.originalUrl === '/api/employees') {
      proxy = req.user._id;
    }

    if (req.originalUrl === '/api/customers') {
      proxy = null;
    }

    // set /api/members
    if (req.originalUrl === '/api/members') {
      proxy = req.user._id;
    }

    // Generate unique 3-digit ID
    const newId = await IdGen.next(User, 'id', 6); // Generate a 6-digit unique ID

    const clientIP =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || // 代理服务器传递的真实 IP
      req.socket.remoteAddress || // 从 socket 获取的 IP 地址
      'unknown';

    const normalizedIP =
      clientIP === '::1' || clientIP === ':::1' ? '127.0.0.1' : clientIP;

    const newUser = new User({
      ...req.body,
      password: hashPassword,
      inviteCode,
      proxy,
      id: newId, // Set the new ID
      createdIP: normalizedIP,
    });

    await newUser.save();
    res.status(201).json(newUser);
  },
);

export const getUserById = handleAsync(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id)
    .populate('proxy')
    .populate('roles');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  } else {
    const employees = await User.find({ proxy: user._id }).populate('roles');

    res.json({
      success: true,
      data: {
        ...exclude(user.toObject(), 'password'),
        employees: employees.map((employee) =>
          exclude(employee.toObject(), 'password'),
        ),
      },
    });
  }
});

export const updateUser = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { liquidRate, stakeRate, ...body } = req.body;

  const user = await User.findById(id);

  if (!user) {
    res.status(404);
    throw new Error('用户未找到');
  }

  let hashPassword = user.password;

  if (body.password) {
    const salt = await bcrypt.genSalt(10);
    hashPassword = await bcrypt.hash(body.password, salt);
  }

  const newRoles = body.roles ? body.roles : user.roles;

  const updatedUser = await User.findByIdAndUpdate(
    id,
    {
      name: body.name,
      email: body.email,
      password: hashPassword,
      live: body.live,
      roles: newRoles,
      liquidRate,
      stakeRate,
    },
    { new: true },
  );

  res.json({
    success: true,
    data: updatedUser,
  });
});

export const deleteUser = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 删除用户
  const proxy = await User.findByIdAndDelete(id);

  if (!proxy) {
    res.status(404);
    throw new Error('用户未找到');
  }

  res.json({
    success: true,
    data: { message: 'User deleted successfully' },
  });
});

export const deleteMultipleUsers = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    // 使用 Mongoose 的 deleteMany 方法进行批量删除
    await User.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} proxies deleted successfully`,
    });
  },
);
