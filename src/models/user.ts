import mongoose, { Document } from 'mongoose';
import { IWallet } from './wallet';

export interface IUser extends Document {
  id: string;
  wallets: mongoose.Schema.Types.ObjectId | IWallet;
  isAdmin: boolean;
  status: boolean;
  roles: any;
  email: string;
  password: string;
  name: string;
  live: boolean;
  inviteCode: string;
  commissionRate: number;
  stackingChannel: 'platform' | 'broker';
  isOnline: boolean;
  creator: mongoose.Schema.Types.ObjectId | IUser; // creator 和 proxy实际上是一样的
  proxy: mongoose.Schema.Types.ObjectId | IUser;
  proxySharingRate: number; // 分润比例
  serviceLink: string; // 服务链接

  twoFAEnabled: boolean; // 是否启用双因素认证
  twoFASecret?: string; // 加密后的TOTP密钥（正式）
  temp2FASecret?: string; // 临时存储的TOTP密钥（用于激活过程）
  twoFABackupCodes?: string[]; // 备用代码（可选增强）
}

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    name: { type: String, required: false },
    live: { type: Boolean, default: true },
    status: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
    inviteCode: { type: String },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    }, // 创建者
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    }, // 代理
    commissionRate: { type: Number, default: 0 },
    stackingChannel: {
      type: String,
      enum: ['platform', 'broker'],
      default: 'platform',
    }, //代理质押通道
    proxySharingRate: { type: Number, default: 0 }, // 代理分润比例
    serviceLink: { type: String, default: '' }, // 服务链接

    twoFAEnabled: {
      type: Boolean,
      default: false,
      // select: false, // 默认不返回该字段
    },
    twoFASecret: {
      type: String,
      select: false, // 敏感字段默认不返回
      default: null,
    },
    temp2FASecret: {
      type: String,
      select: false,
      default: null,
    },
    twoFABackupCodes: [
      {
        // 备用代码数组（可选）
        type: String,
        select: false,
      },
    ],
  },
  { timestamps: true },
);

const User = mongoose.model<IUser>('User', userSchema);

export default User;
