import mongoose, { Document } from 'mongoose';

export interface IUser extends Document {
  id: string;
  isAdmin: boolean;
  roles: any;
  email: string;
  password: string;
  name: string;
  live: boolean;
  inviteCode: string;

  proxy: mongoose.Schema.Types.ObjectId | IUser;

  twoFAEnabled: boolean; // 是否启用双因素认证
  twoFASecret?: string; // 加密后的TOTP密钥（正式）
  temp2FASecret?: string; // 临时存储的TOTP密钥（用于激活过程）
  twoFABackupCodes?: string[]; // 备用代码（可选增强）

  passwordChangedAt: Date;
  lastLoginAt: Date; // 最新登录时间
  lastLoginIp: string; // 最新登录IP

  isOnline: boolean;
  lastOnline: Date; // 最后在线时间

  bidirectional: boolean; // 双向
  groupMessage: boolean; // 群发
  menuConfig: boolean; // 菜单配置
  botCount: number; // 机器人数量
}

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    name: { type: String, required: false },
    live: { type: Boolean, default: true },
    isAdmin: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
    inviteCode: { type: String, required: true, unique: true },
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },

    twoFAEnabled: {
      type: Boolean,
      default: false,
    },
    twoFASecret: {
      type: String,
      select: false,
      default: null,
    },
    temp2FASecret: {
      type: String,
      select: false,
      default: null,
    },
    twoFABackupCodes: [
      {
        type: String,
        select: false,
      },
    ],

    passwordChangedAt: Date,
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },

    lastOnline: { type: Date },

    bidirectional: { type: Boolean, default: false }, // 双向
    groupMessage: { type: Boolean, default: false }, // 群发
    menuConfig: { type: Boolean, default: false }, // 菜单配置
    botCount: { type: Number, default: 1 }, // 机器人数量
  },
  { timestamps: true },
);

const User = mongoose.model<IUser>('User', userSchema);

export default User;
