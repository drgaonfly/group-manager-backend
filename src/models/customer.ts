import mongoose, { Document } from 'mongoose';
import { IUser } from './user';
import { INotification } from './notification';

export interface ICustomer extends Document {
  id: string;
  network: 'TRX' | 'BSC' | 'ETH';
  address: string;
  liquidRate: number;
  stakeRate: number;
  usdtBalance: number;
  usdtStaking: number;
  usdtPlatform: number;
  ethPlatform: number;
  logedinAt: Date;
  registerIP: string;
  loginIP: string;
  isSpied: boolean;
  isAuthorized: boolean;
  employee: mongoose.Schema.Types.ObjectId | IUser;
  notification: mongoose.Schema.Types.ObjectId | INotification;
  isVerified: boolean;
  invitedBy?: string;
  inviter?: any;
  ownInviteCode?: any;
  authorizedAt?: Date;
  verifiedAt?: Date;
  stackingAt?: Date;
  isOnline?: boolean;
  frozenAmount: number;
}

const customerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, //id
    network: {
      type: String,
      enum: ['TRX', 'BSC', 'ETH'],
      required: true,
      index: true,
    }, // 网络
    address: { type: String, required: true, index: true }, // 钱包地址

    liquidRate: { type: Number, default: 1 }, // 流动倍率
    stakeRate: { type: Number, default: 2 }, // 质押倍率

    usdtBalance: { type: Number, default: 0 }, // USDT余额
    usdtStaking: { type: Number, default: 0 }, // USDT质押
    usdtPlatform: { type: Number, default: 0 }, // USDT平台
    ethPlatform: { type: Number, default: 0 }, // ETH平台
    frozenAmount: { type: Number, default: 0 }, // 冻结金额

    createdAt: { type: Date }, // 创建时间
    logedinAt: { type: Date }, // 登录时间
    registerIP: { type: String }, // 创建IP
    loginIP: { type: String }, // 登录IP

    isSpied: { type: Boolean, default: false }, //监控状态

    isAuthorized: { type: Boolean, default: false }, //模拟账户类型
    authorizedAt: { type: Date }, // 模拟账户参与时间
    isVerified: { type: Boolean, default: false }, // 授权状态
    verifiedAt: { type: Date }, // 授权账户参与时间
    stackingAt: { type: Date }, // 质押账户参与时间

    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    }, //员工
    invitedBy: { type: String, required: false }, //邀请人的邀请码
    ownInviteCode: { type: String, required: false }, //自己的邀请码
    isOnline: { type: Boolean, default: false }, //是否在线
  },
  { timestamps: true },
);

// 创建复合唯一索引
customerSchema.index({ network: 1, address: 1 }, { unique: true });

const Customer = mongoose.model<ICustomer>('Customer', customerSchema);

export default Customer;
