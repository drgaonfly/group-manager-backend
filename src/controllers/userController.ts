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
    } = req.query;

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

    // 查询用户
    const users = await User.find(query)
      .populate('roles')
      .populate('proxy') // 加载代理信息
      .sort('-createdAt') // Sort by creation time in descending order
      .limit(+pageSize)
      .skip((+current - 1) * +pageSize)
      .exec();

    // 查询用户的 wallet 数据
    const usersWithWallets = await Promise.all(
      users.map(async (user) => {
        // 查询与该用户关联的钱包
        const wallets = await Wallet.find({ user: user._id }).select(
          'network type address balance',
        );

        return {
          ...exclude(user.toObject(), 'password'),
          hasWallet: wallets.length > 0, // 是否存在钱包
          wallets, // 具体钱包信息
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

    const newUser = new User({
      ...req.body,
      password: hashPassword,
      inviteCode,
      proxy,
    });

    const savedUser = await newUser.save();

    res.json({
      success: true,
      data: exclude(savedUser.toObject(), 'password'),
    });
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
  const { ...body } = req.body;

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
