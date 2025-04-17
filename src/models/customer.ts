import mongoose, { Document } from 'mongoose';
import { IUser } from './user';
import { INotification } from './notification';
import { IWallet } from './wallet';

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
  inviter: mongoose.Schema.Types.ObjectId | ICustomer;
  ownInviteCode?: string;
  authorizedAt?: Date;
  verifiedAt?: Date;
  stackingAt?: Date;
  isOnline?: boolean;
  frozenAmount: number;
  stakingFrozenAmount: number;
  authorizedWallet: mongoose.Schema.Types.ObjectId | IWallet;

  isDemoAccount: boolean;
  demoAt: Date;

  proxy: mongoose.Schema.Types.ObjectId | IUser;
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
    frozenAmount: { type: Number, default: 0 }, // 冻结金额  提现用的
    stakingFrozenAmount: { type: Number, default: 0 }, // 质押冻结金额

    createdAt: { type: Date }, // 创建时间
    logedinAt: { type: Date }, // 登录时间
    registerIP: { type: String }, // 创建IP
    loginIP: { type: String }, // 登录IP

    isSpied: { type: Boolean, default: false }, //监控状态

    isAuthorized: { type: Boolean, default: false }, //模拟账户类型
    authorizedAt: { type: Date }, // 模拟账户参与时间

    isDemoAccount: { type: Boolean, default: false }, //演示账号
    demoAt: { type: Date }, // 模拟时间

    isVerified: { type: Boolean, default: false }, // 授权状态
    verifiedAt: { type: Date }, // 授权账户参与时间
    stackingAt: { type: Date }, // 质押账户参与时间

    // 授权钱包
    authorizedWallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: false,
    },

    inviter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: false,
    }, // 邀请人

    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    }, // 员工

    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    }, // 代理
    invitedBy: { type: String, required: false }, //邀请人的邀请码
    ownInviteCode: { type: String, required: false }, //自己的邀请码
    isOnline: { type: Boolean, default: false }, //是否在线
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// 添加虚拟属性withdraws，关联提现记录
customerSchema.virtual('withdraws', {
  ref: 'Withdraw',
  localField: '_id',
  foreignField: 'customer',
});

// 添加虚拟属性stakings，关联质押记录
customerSchema.virtual('stakings', {
  ref: 'Stacking',
  localField: '_id',
  foreignField: 'customer',
});

// 添加虚拟属性transfers，关联转账记录
customerSchema.virtual('transfers', {
  ref: 'Transfer',
  localField: '_id',
  foreignField: 'customer',
});

// 添加虚拟属性incomes，关联收益记录
customerSchema.virtual('incomes', {
  ref: 'Income',
  localField: '_id',
  foreignField: 'customer',
});

// 添加虚拟属性activities，关联活动记录
customerSchema.virtual('activities', {
  ref: 'Activity',
  localField: '_id',
  foreignField: 'customer',
});

// 创建复合唯一索引
customerSchema.index({ network: 1, address: 1 }, { unique: true });

const Customer = mongoose.model<ICustomer>('Customer', customerSchema);

export default Customer;
