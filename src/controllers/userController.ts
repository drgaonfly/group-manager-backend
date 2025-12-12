// controllers/userController.ts
import { Request, Response } from 'express';
import User from '../models/user';
import handleAsync from '../utils/handleAsync';
import bcrypt from 'bcrypt';
import { exclude } from '../utils/handleData';
import { RequestCustom } from 'user';
import crypto from 'crypto';
import { isEmployee, isProxy } from '../middlewares/authMiddleware';
import Role from '../models/role';
import { IdGen } from '../utils/idGen';
import Customer from '../models/customer';

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
      isOnline,
      inviteCode,
      current = '1',
      pageSize = '10',
    } = req.query;

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

    if (isOnline !== '') {
      query.isOnline = isOnline === 'true';
    }

    // 员工查询逻辑
    if (
      req.baseUrl + req.route.path === '/api/employees/' &&
      isProxy(req.user) &&
      !req.getAllData
    ) {
      query.proxy = req.user._id;
    }

    // 员工角色过滤
    if (req.baseUrl + req.route.path === '/api/employees/') {
      const employeeRole = await Role.findOne({ name: '员工' });
      query.roles = [employeeRole?._id];
    }

    // 代理角色过滤
    if (req.baseUrl + req.route.path === '/api/proxies/') {
      const proxyRole = await Role.findOne({ name: '代理' });
      query.roles = [proxyRole?._id];

      // 如果是代理用户，且不是超级管理员，只能看到自己创建的代理
      if (isProxy(req.user) && !req.user.isAdmin) {
        query.proxy = req.user._id;
      }
    }

    // 如果是超级管理员，不能看超级管理员
    if (req.user.isAdmin && req.baseUrl + req.route.path === '/api/users/') {
      query.isAdmin = false;
    }

    const users = await User.find(query)
      .populate('proxy')
      .populate('roles')
      .sort('-createdAt') // 按创建时间降序排序
      .limit(+pageSize)
      .skip((+current - 1) * +pageSize)
      .exec();

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: users.map((user) => exclude(user.toObject(), 'password')),
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

    // 根据不同的路径设置不同的值
    if (req.originalUrl === '/api/employees') {
      proxy = req.user._id;
    }

    if (req.originalUrl === '/api/proxies') {
      proxy = req.user._id;
    }

    // Generate unique ID
    const newId = await IdGen.next(User, 'id', 6);

    const clientIP =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown';

    const normalizedIP =
      clientIP === '::1' || clientIP === ':::1' ? '127.0.0.1' : clientIP;

    const newUser = new User({
      ...req.body,
      password: hashPassword,
      inviteCode,
      proxy,
      id: newId,
      createdIP: normalizedIP,
      creator: req.user._id,
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
  }

  const employeeRole = await Role.findOne({ name: '员工' });
  const proxyRole = await Role.findOne({ name: '代理' });

  const employees = await User.find({
    proxy: user._id,
    roles: employeeRole._id, // Use the role ID for filtering employees
  }).populate('roles');

  const proxies = await User.find({
    proxy: user._id,
    roles: proxyRole._id, // Use the role ID for filtering proxies
  }).populate('roles');

  // 获取客户列表
  let customers;

  if (isEmployee(user)) {
    // 如果是员工，直接查找关联的客户
    customers = await Customer.find({ employee: user._id }).populate(
      'employee',
    );
  } else if (isProxy(user)) {
    // 如果是代理，先获取所有下属员工
    const employeeIds = employees.map((emp) => emp._id);
    // 然后查找所有这些员工关联的客户
    customers = await Customer.find({
      employee: { $in: employeeIds },
    }).populate('employee');
  }

  res.json({
    success: true,
    data: {
      ...user.toObject(),
      employees,
      proxies,
      customers,
    },
  });
});

export const updateUser = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const {
    liquidRate,
    stakeRate,
    isOnline,
    proxySharingRate,
    stackingChannel,
    serviceLink,
    bidirectional,
    groupMessage,
    keyboardConfig,
    botCount,
    availableBotCount,
    speech_static,
    groupWelcome,
    ...body
  } = req.body;

  console.log('speech_static', speech_static);

  const user = await User.findById(id).select('+password');

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
      stackingChannel,
      isOnline,
      proxySharingRate,
      name: body.name,
      email: body.email,
      password: hashPassword,
      live: body.live,
      roles: newRoles,
      liquidRate,
      stakeRate,
      serviceLink, // 服务链接
      bidirectional, // 双向
      groupMessage, // 群发
      keyboardConfig, // 菜单配置
      botCount, // 当前机器人数量
      availableBotCount, // 可用机器人数量
      speech_static,
      groupWelcome,
    },
    { new: true },
  );

  console.log('updatedUser.speech_static', updatedUser?.speech_static);

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
