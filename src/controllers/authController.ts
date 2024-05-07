import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/user'; // 假设你的用户模型位于 /models/User.ts
import { generateToken, generateRefreshToken } from '../utils/generateToken';
import handleAsync from '../utils/handleAsync';
import { exclude } from '../utils/handleData';
import {RequestCustom} from "user";

const login = handleAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ $or: [{ email }, { name: email }] });

  if (!user) {
    res.status(400);
    throw new Error('User not found');
  }

  if (!user.live) {
    res.status(401);
    throw new Error('User is not live');
  }

  if (await bcrypt.compare(password, user.password)) {
    const refreshToken = generateRefreshToken(user._id);

    res.json({
      success: true,
      name: user.name || user.email,
      token: generateToken(user.id),
      refreshToken,
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});
interface DecodedToken {
  id: string;
}

const refreshToken = handleAsync(async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(401);
      throw new Error('You are not authenticated!');
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_JWT_SECRET as string) as DecodedToken;
    const newRefreshToken = generateRefreshToken(decoded.id);

    res.json({
      success: true,
      token: generateToken(decoded.id),
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error(err);
    res.status(401);
    throw new Error(err.message || 'Not authorized, token failed');
  }
});

const getUserProfile = handleAsync(async (req: RequestCustom, res: Response) => {
  // 确保在请求处理流程中间件中已经添加了解析 JWT 并设置 req.user
  const user: IUser | null = await User.findById(req.user?._id);

  if (user) {
    res.json({
      success: true,
      data: {
        ...exclude(user.toObject(), 'password'),
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/BiazfanxmamNRoxxVxka.png',
      },
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

const updateUserProfile = handleAsync(async (req: RequestCustom, res: Response) => {
  const { password, name, email, currentPassword, confirmPassword } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    res.status(401);
    throw new Error('User not authenticated');
  }

  if (confirmPassword && confirmPassword !== password) {
    res.status(400);
    throw new Error('Passwords do not match');
  }

  const user = await User.findById(userId);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // 验证当前密码
  if (currentPassword && !(await bcrypt.compare(currentPassword, user.password))) {
    res.status(400);
    throw new Error('Current password is incorrect');
  }

  // 如果提供了新密码，则加密它
  let hashPassword = user.password;
  if (password) {
    const salt = await bcrypt.genSalt(10);
    hashPassword = await bcrypt.hash(password, salt);
  }

  const updatedUser = await User.findByIdAndUpdate(userId, {
    name: name || user.name,
    email: email || user.email,
    password: hashPassword,
  }, { new: true });

  res.json({
    success: true,
    name: updatedUser?.name,
    email: updatedUser?.email,
    token: generateToken(updatedUser!.id), // 注意: 请确保 generateToken 可以接受用户的 id 类型
  });
});

export { login, getUserProfile, updateUserProfile, refreshToken };
