// controllers/userController.ts
import { Request, Response } from 'express';
import User from '../models/user';
import handleAsync from '../utils/handleAsync';
import bcrypt from 'bcrypt';
import { exclude } from '../utils/handleData';
import { RequestCustom } from 'user';
import crypto from 'crypto';

async function generateInviteCode(length: number = 8): Promise<string> {
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

const getUsers = handleAsync(async (req: Request, res: Response) => {
  const { email, name, live, current = '1', pageSize = '10' } = req.query;

  const query: any = {};

  if (email) {
    query.email = email;
  }

  if (name) {
    query.name = { $regex: name, $options: 'i' };
  }

  if (live) {
    query.live = live === 'true';
  }

  // 执行查询
  const users = await User.find({
    ...query,
  })
    .populate('topic')
    .populate('roles')
    .sort('-createdAt') // Sort by creation time in descending order
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await User.countDocuments({
    ...query,
  }).exec();

  res.json({
    success: true,
    data: users.map((user) => exclude(user.toObject(), 'password')),
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

const addUser = handleAsync(async (req: RequestCustom, res: Response) => {
  const { name, email, password, roles } = req.body;

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const salt = await bcrypt.genSalt(10);
  const hashPassword = await bcrypt.hash(password, salt);

  const inviteCode = await generateInviteCode();

  const newUser = new User({
    name,
    email,
    roles,
    password: hashPassword,
    inviteCode,
  });

  const savedUser = await newUser.save();

  res.json({
    success: true,
    data: exclude(savedUser.toObject(), 'password'),
  });
});

const getUserById = handleAsync(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  } else {
    res.json({
      success: true,
      data: exclude(user.toObject(), 'password'),
    });
  }
});

const updateUser = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { password, name, email, live, roles } = req.body;

  const user = await User.findById(id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  let hashPassword = user.password;

  if (password) {
    const salt = await bcrypt.genSalt(10);
    hashPassword = await bcrypt.hash(password, salt);
  }

  const newRoles = roles ? roles : user.roles;

  const updatedUser = await User.findByIdAndUpdate(
    id,
    {
      name,
      email,
      password: hashPassword,
      live,
      roles: newRoles,
    },
    { new: true },
  );

  res.json({
    success: true,
    data: updatedUser,
  });
});

const deleteUser = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 删除用户
  const user = await User.findByIdAndDelete(id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  res.json({
    success: true,
    data: { message: 'User deleted successfully' },
  });
});

const deleteMultipleUsers = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body;

  // 使用 Mongoose 的 deleteMany 方法进行批量删除
  await User.deleteMany({
    _id: { $in: ids },
  });

  res.json({
    success: true,
    message: `${ids.length} users deleted successfully`,
  });
});

export {
  deleteMultipleUsers,
  updateUser,
  deleteUser,
  getUsers,
  addUser,
  getUserById,
};
