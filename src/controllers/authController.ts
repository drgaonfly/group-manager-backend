import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy'; // 新增speakeasy
import QRCode from 'qrcode'; // 新增qrcode
import User from '../models/user'; // 假设你的用户模型位于 /models/User.ts
import { generateToken, generateRefreshToken } from '../utils/generateToken';
import handleAsync from '../utils/handleAsync';
import { exclude } from '../utils/handleData';
import { RequestCustom } from 'user';
import { redis } from '../utils/redis';
import { v4 as uuidv4 } from 'uuid';

const login = handleAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // 查找用户，允许通过 email 或者 name 查找
  const user = await User.findOne({ $or: [{ email }, { name: email }] }).select(
    '+password',
  );

  if (!user) {
    res.status(400);
    throw new Error('User not found');
  }

  // 验证密码是否匹配
  if (await bcrypt.compare(password, user.password)) {
    // 检查 2FA 状态
    if (user.twoFAEnabled) {
      const sessionId = uuidv4();
      await redis.setex(`loginSession:${sessionId}`, 300, user._id.toString());
      res.json({ requires2FA: true, sessionId });
      return;
    }
    // 生成 refresh token 和 access token
    const refreshToken = generateRefreshToken(user._id.toString());
    const token: string = generateToken(user._id);

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // 更新下 lastLoginAt
    await User.findByIdAndUpdate(user._id, {
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    });

    // 返回成功响应并携带令牌
    res.json({
      success: true,
      name: user.name || user.email,
      token,
      refreshToken,
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

// Setup 2FA for user
export const setup2FA = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const user = await User.findById(req.user._id).select('+temp2FASecret');

    const secret = speakeasy.generateSecret({
      length: 32,
      name: `multiBot(${user.email})`,
      issuer: 'multiBotBackend', // 请替换为实际项目名称
    });

    await User.findByIdAndUpdate(user._id, {
      temp2FASecret: secret.base32, // 只保存临时密钥
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      success: true,
      qrCode,
      tempSecret: secret.base32, // 可选：返回临时密钥用于测试
    });
  },
);

// Verify 2FA token
export const verify2FA = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { token } = req.body;

    const user = await User.findById(req.user._id).select('+temp2FASecret');

    if (!user.temp2FASecret) {
      res.status(400);
      throw new Error('2FA not enabled for this user');
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.temp2FASecret,
      encoding: 'base32',
      token: token.toString().trim(),
      window: 2,
      step: 30,
      algorithm: 'sha1',
    });

    if (!verified) {
      res.status(401);
      throw new Error('Invalid 2FA token');
    }

    // Update user's 2FA status
    await User.findByIdAndUpdate(user._id, {
      temp2FASecret: null,
      twoFASecret: user.temp2FASecret,
      twoFAEnabled: true,
    });

    res.json({
      success: true,
    });
  },
);

// Verify 2FA during login
export const verify2FALogin = handleAsync(
  async (req: Request, res: Response) => {
    const { sessionId, token } = req.body;

    // Get userId from Redis session
    const userId = await redis.get(`loginSession:${sessionId}`);

    if (!userId) {
      res.status(401);
      throw new Error('Session expired');
    }

    // Find user and verify 2FA token
    const user = await User.findById(userId).select('+twoFASecret');

    if (!user || !user.twoFASecret) {
      res.status(400);
      throw new Error('User not found or 2FA not enabled');
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFASecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!verified) {
      res.status(401);
      throw new Error('Invalid 2FA token');
    }

    // Clear login session and generate tokens
    await redis.del(`loginSession:${sessionId}`);
    const refreshToken = generateRefreshToken(user._id.toString());
    const accessToken = generateToken(user._id);

    res.json({
      success: true,
      name: user.name || user.email,
      token: accessToken,
      refreshToken,
    });
  },
);

interface DecodedToken {
  sub: string;
}

const refreshToken = handleAsync(async (req: Request, res: Response) => {
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
      success: true,
      token: generateToken(decoded.sub),
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error(err);
    res.status(401);
    throw new Error(err.message || 'Not authorized, token failed');
  }
});

const getUserProfile = handleAsync(
  async (req: RequestCustom, res: Response) => {
    res.json({
      success: true,
      data: {
        ...exclude(req.user.toObject(), 'password'),
        avatar:
          'https://gw.alipayobjects.com/zos/rmsportal/BiazfanxmamNRoxxVxka.png',
      },
    });
  },
);

const updateUserProfile = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const {
      password,
      name,
      email,
      currentPassword,
      confirmPassword,
      serviceLink,
      bidirectional,
      groupMessage,
      keyboardConfig,
      speech_static,
      groupWelcome,
      groupVerify,
      channelPost,
      reportGroupMemberNameUpdated,
      replyRule,
      botCount,
      availableBotCount,
    } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    // 验证确认密码是否匹配
    if (confirmPassword && confirmPassword !== password) {
      res.status(400);
      throw new Error('Passwords do not match');
    }

    // 验证新密码是否与原密码相同
    if (password && password === currentPassword) {
      res.status(400);
      throw new Error('New password cannot be the same as current password');
    }

    // 验证当前密码
    if (
      currentPassword &&
      !(await bcrypt.compare(currentPassword, user.password))
    ) {
      res.status(400);
      throw new Error('Current password is incorrect');
    }

    // 如果提供了新密码，则加密它
    let hashPassword = user.password;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      hashPassword = await bcrypt.hash(password, salt);
    }

    // 构建更新对象
    const updateData: any = {
      name: name || user.name,
      email: email || user.email,
      password: hashPassword,
      serviceLink,
      botCount,
      availableBotCount,
    };

    // 只有管理员可以修改权限相关字段
    if (req.user.isAdmin) {
      if (typeof bidirectional !== 'undefined') {
        updateData.bidirectional = bidirectional;
      }
      if (typeof groupMessage !== 'undefined') {
        updateData.groupMessage = groupMessage;
      }
      if (typeof keyboardConfig !== 'undefined') {
        updateData.keyboardConfig = keyboardConfig;
      }
      if (typeof speech_static !== 'undefined') {
        updateData.speech_static = speech_static;
      }
      if (typeof groupWelcome !== 'undefined') {
        updateData.groupWelcome = groupWelcome;
      }
      if (typeof channelPost !== 'undefined') {
        updateData.channelPost = channelPost;
      }
      if (typeof groupVerify !== 'undefined') {
        updateData.groupVerify = groupVerify;
      }
      if (typeof reportGroupMemberNameUpdated !== 'undefined') {
        updateData.reportGroupMemberNameUpdated = reportGroupMemberNameUpdated;
      }
      if (typeof replyRule !== 'undefined') {
        updateData.replyRule = replyRule;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(user._id, updateData, {
      new: true,
    });

    // 如果修改了密码，更新密码修改时间
    if (password) {
      await User.findByIdAndUpdate(user._id, {
        passwordChangedAt: new Date(),
      });
    }

    res.json({
      success: true,
      serviceLink,
      name: updatedUser?.name,
      email: updatedUser?.email,
      token: generateToken(updatedUser!.id), // 注意: 请确保 generateToken 可以接受用户的 id 类型
    });
  },
);

// Disable 2FA for user
export const disable2FA = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { password, token } = req.body;
    const user = await User.findById(req.user._id).select(
      '+password +twoFASecret +twoFAEnabled',
    );

    if (!user.twoFAEnabled) {
      res.status(400);
      throw new Error('2FA is not enabled for this user');
    }

    // Verify password first
    if (!(await bcrypt.compare(password, user.password))) {
      res.status(401);
      throw new Error('Invalid password');
    }

    // Verify 2FA token
    const verified = speakeasy.totp.verify({
      secret: user.twoFASecret,
      encoding: 'base32',
      token: token.toString().trim(),
      window: 1,
    });

    if (!verified) {
      res.status(401);
      throw new Error('Invalid 2FA token');
    }

    // Disable 2FA by clearing secrets and setting enabled to false
    await User.findByIdAndUpdate(user._id, {
      twoFASecret: null,
      temp2FASecret: null,
      twoFAEnabled: false,
    });

    res.json({
      success: true,
      message: '2FA has been disabled successfully',
    });
  },
);

export { login, getUserProfile, updateUserProfile, refreshToken };
