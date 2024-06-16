// controllers/userController.ts
import { Request, Response } from 'express';
import User, { IPriceList, IUser } from '../models/user';
import handleAsync from '../utils/handleAsync';
import bcrypt from "bcrypt";
import { exclude } from '../utils/handleData';
import { readPriceExcelData, readUserExcelData } from '../utils/processExcelFile';
import { ROLES } from '../constants';
import { RequestCustom } from 'user';

const getUsers = handleAsync(async (req: Request, res: Response) => {
  // 假设这些值来自于请求参数
  const { email, name, role, live, current = '1', pageSize = '10' } = req.query;

  const query: any = {};

  if (email) {
    query.email = email;
  }

  if (role) {
    query.role = role;
  }

  if (name) {
    query.name = { $regex: name, $options: 'i' }; // 使用正则表达式进行大小写不敏感的搜索
  }

  if (live) {
    query.live = live === 'true'; // 将字符串 "true" 转换为布尔值 true
  }

  // 执行查询
  const users = await User.find({
    ...query,
    role: { $ne: ROLES.SuperAdmin }  // Exclude users with the role of SuperAdmin
  })
    .sort('-createdAt')  // Sort by creation time in descending order
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await User.countDocuments({
    ...query,
    role: { $ne: ROLES.SuperAdmin }  // Exclude users with the role of SuperAdmin
  }).exec();

  res.json({
    success: true,
    data: users.map(user => exclude(user.toObject(), 'password')),
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

const addUser = handleAsync(async (req: RequestCustom, res: Response) => {
  const { name, email, password, role, priceList } = req.body;

  if (role === ROLES.SuperAdmin && req.user.role !== ROLES.SuperAdmin) {
    res.status(403);
    throw new Error('Only superadmin can create other superadmins');
  }

  if (role !== ROLES.Customer && req.user.role === ROLES.CustomerService) {
    res.status(403);
    throw new Error('Customer service can only create customers');
  }

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const salt = await bcrypt.genSalt(10);
  const hashPassword = await bcrypt.hash(password, salt);

  const newUser = new User({
    name,
    email,
    role,
    password: hashPassword,
    priceList
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
  const { password, name, email, live, role, priceList } = req.body;

  // 寻找用户是否存在
  const user = await User.findById(id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  let hashPassword = user.password;

  // 如果提供了新密码，对其加密
  if (password) {
    const salt = await bcrypt.genSalt(10);
    hashPassword = await bcrypt.hash(password, salt);
  }

  const newRole = role ? role : user.role;

  // 更新用户信息
  const updatedUser = await User.findByIdAndUpdate(
    id,
    { name, email, password: hashPassword, live, role: newRole, priceList },
    { new: true }
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

export const uploadUsers = handleAsync(async (req: Request, res: Response) => {
  const file = req.body.file;

  if (!file) {
    res.status(400);
    throw new Error('File not provided in the request body');
  }

  const userData = await readUserExcelData(file);

  // Save each user to the database
  const savedUsers = await Promise.all(
    userData.map(async (user: IUser) => {
      try {
        const newUser = new User({
          email: user.email,
          name: user.name,
          password: user.password,
        });
        return await newUser.save();
      } catch (error) {
        console.error(`Failed to save user: ${user.email}`, error);
        return null;
      }
    })
  );

  // Filter out null values (failed operations)
  const successfulUsers = savedUsers.filter(user => user !== null);

  const userIds = successfulUsers.map(user => user._id);

  res.json({
    success: true,
    message: 'Users uploaded successfully',
    data: userIds
  });
});

export const uploadPrices = handleAsync(async (req: Request, res: Response) => {
  const file = req.body.file;

  if (!file) {
    res.status(400);
    throw new Error('File not provided in the request body');
  }

  const priceData: { email: string; priceList: IPriceList[] }[] = await readPriceExcelData(file);

  for (const data of priceData) {
    const user = await User.findOne({ email: data.email });

    if (user) {
      user.priceList = data.priceList;
      await user.save();
    }
  }
  // Save each price to the database

  res.json({
    success: true,
    message: 'Prices uploaded successfully',
    data: priceData
  });
});

export { deleteMultipleUsers, updateUser, deleteUser, getUsers, addUser, getUserById }
