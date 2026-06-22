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

  availableBotCount: number; // 可用机器人数量（配额）

  function_disabledAt: Date; // 功能禁用时间，给代理角色的

  groupMessage: boolean; // 群发
  keyboardConfig: boolean; // 菜单配置
  speech_static: boolean; // 群组内发言统计
  groupWelcome: boolean; // 欢迎进群
  groupVerify: boolean;
  channelPost: boolean; // 频道推广
  reportGroupMemberNameUpdated: boolean; // 报道群内用户的名字变更
  replyRule: boolean; // 关键词回复
  checkinRule: boolean;
  lotteryRule: boolean;
  auctionRule: boolean;
  adRemoval: boolean; // 广告移除
  recharge: boolean;
  success: boolean;
  redPacket: boolean; // 红包
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

    availableBotCount: { type: Number, default: 1 }, // 可用机器人数量（配额）

    function_disabledAt: { type: Date, default: null }, // 功能禁用时间

    groupMessage: { type: Boolean, default: false }, // 群发
    keyboardConfig: { type: Boolean, default: false }, // 菜单配置
    speech_static: { type: Boolean, default: false }, // 群组内发言统计
    groupWelcome: { type: Boolean, default: false }, // 欢迎进群
    groupVerify: { type: Boolean, default: false },
    channelPost: { type: Boolean, default: false }, // 频道推广
    reportGroupMemberNameUpdated: { type: Boolean, default: false }, // 报道群内用户的名字变更
    replyRule: { type: Boolean, default: false }, // 关键词回复
    checkinRule: { type: Boolean, default: false },
    lotteryRule: { type: Boolean, default: false },
    auctionRule: { type: Boolean, default: false },
    adRemoval: { type: Boolean, default: false }, // 广告移除
    recharge: { type: Boolean, default: false },
    success: { type: Boolean, default: false },
    redPacket: { type: Boolean, default: false }, // 红包
  },
  { timestamps: true },
);

const User = mongoose.model<IUser>('User', userSchema);

export default User;
