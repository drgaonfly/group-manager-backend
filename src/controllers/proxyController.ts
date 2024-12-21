// controllers/userController.ts
import { Request, Response } from 'express';
import Proxy from '../models/user';
import handleAsync from '../utils/handleAsync';
import bcrypt from 'bcrypt';
import { exclude } from '../utils/handleData';
import { RequestCustom } from 'user';
import Role from '../models/role';

const getProxys = handleAsync(async (req: Request, res: Response) => {
  const {
    email,
    name,
    live,
    current = '1',
    pageSize = '10',
    inviteCode,
  } = req.query;

  const query: any = {};

  if (inviteCode) {
    query.inviteCode = inviteCode;
  }

  if (email) {
    query.email = email;
  }

  if (name) {
    query.name = { $regex: name, $options: 'i' };
  }

  if (live) {
    query.live = live === 'true';
  }

  // 找到所有角色为 "代理" 的角色ID
  const roles = await Role.find({ name: '代理' });
  if (roles.length > 0) {
    query.roles = { $in: roles.map((role) => role._id) }; // 筛选出有代理的
  }

  // 执行查询
  const proxys = await Proxy.find({
    ...query,
  })
    .populate('roles')
    .sort('-createdAt') // Sort by creation time in descending order
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Proxy.countDocuments({
    ...query,
  }).exec();

  res.json({
    success: true,
    data: proxys.map((proxy) => exclude(proxy.toObject(), 'password')),
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

const addProxy = handleAsync(async (req: RequestCustom, res: Response) => {
  const { email, password, roles, name } = req.body;

  const proxyExists = await Proxy.findOne({ email });

  if (proxyExists) {
    res.status(400);
    throw new Error('Proxy already exists');
  }

  const salt = await bcrypt.genSalt(10);
  const hashPassword = await bcrypt.hash(password, salt);

  const newUser = new Proxy({
    // isProxy,
    // proxys,
    email,
    roles,
    password: hashPassword,
    name,
  });

  const savedProxy = await newUser.save();

  res.json({
    success: true,
    data: exclude(savedProxy.toObject(), 'password'),
  });
});

const getProxyById = handleAsync(async (req: Request, res: Response) => {
  const proxy = await Proxy.findById(req.params.id);

  if (!proxy) {
    res.status(404);
    throw new Error('Proxy not found');
  } else {
    res.json({
      success: true,
      data: exclude(proxy.toObject(), 'password'),
    });
  }
});

const updateProxy = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { password, email, live, roles } = req.body;

  const proxy = await Proxy.findById(id);

  if (!proxy) {
    res.status(404);
    throw new Error('Proxy not found');
  }

  let hashPassword = proxy.password;

  if (password) {
    const salt = await bcrypt.genSalt(10);
    hashPassword = await bcrypt.hash(password, salt);
  }

  const newRoles = roles ? roles : proxy.roles;

  const updatedProxy = await Proxy.findByIdAndUpdate(
    id,
    {
      email,
      password: hashPassword,
      live,
      roles: newRoles,
    },
    { new: true },
  );

  res.json({
    success: true,
    data: updatedProxy,
  });
});

const deleteProxy = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 删除用户
  const proxy = await Proxy.findByIdAndDelete(id);

  if (!proxy) {
    res.status(404);
    throw new Error('Proxy not found');
  }

  res.json({
    success: true,
    data: { message: 'User deleted successfully' },
  });
});

const deleteMultipleProxies = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    // 使用 Mongoose 的 deleteMany 方法进行批量删除
    await Proxy.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} proxies deleted successfully`,
    });
  },
);

export {
  deleteMultipleProxies,
  updateProxy,
  deleteProxy,
  getProxys,
  addProxy,
  getProxyById,
};
