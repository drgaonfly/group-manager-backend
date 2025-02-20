import mongoose, { Document } from 'mongoose';

export interface ICustomer extends Document {
  id: string;
  channel: mongoose.Schema.Types.ObjectId;
  network: 'TRX' | 'BSC' | 'ETH';
  address: string;
  liquidRate: number;
  stakeRate: number;
  usdtBalance: number;
  usdtStaking: number;
  usdtPlatform: number;
  ethPlatform: number;
  createdAt: Date;
  logedinAt: Date;
  registerIP: string;
  loginIP: string;
  isDemo: boolean;
  isSpied: boolean;
  isAuthorized: boolean;
  proxy: mongoose.Schema.Types.ObjectId;
  notification: mongoose.Schema.Types.ObjectId;
}

const customerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, //id
    channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel' }, // 渠道
    network: { type: String, enum: ['TRX', 'BSC', 'ETH'], required: true }, // 网络
    address: { type: String, required: true }, // 钱包地址

    liquidRate: { type: Number, default: 0 }, // 流动倍率
    stakeRate: { type: Number, default: 0 }, // 质押倍率

    usdtBalance: { type: Number, default: 0 }, // USDT余额
    usdtStaking: { type: Number, default: 0 }, // USDT质押
    usdtPlatform: { type: Number, default: 0 }, // USDT平台
    ethPlatform: { type: Number, default: 0 }, // ETH平台

    createdAt: { type: Date }, // 创建时间
    logedinAt: { type: Date }, // 登录时间
    registerIP: { type: String }, // 创建IP
    loginIP: { type: String }, // 登录IP

    isDemo: { type: Boolean, default: false }, //账户类型
    isSpied: { type: Boolean, default: false }, //监控状态
    isAuthorized: { type: Boolean, default: false }, //授权状态
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    }, //代理
  },
  { timestamps: true },
);

const Customer = mongoose.model<ICustomer>('Customer', customerSchema);

export default Customer;
