import mongoose, { Document } from 'mongoose';
import { ICustomer } from './customer';
import { IUser } from './user';
export interface Income extends Document {
  usdtIncome: number;
  remarks?: string;
  customer: mongoose.Schema.Types.ObjectId | ICustomer;
  isAuthorized: boolean;
  isVerified: boolean;
  customerRewards: number;
  customerLiquidRate: number;
  customerStakeRate?: number; // 添加质押倍率字段
  stakingIcome: boolean;
  createdAt: Date;
  updatedAt?: Date;
  employee: mongoose.Schema.Types.ObjectId | IUser;
  ethIncome: number; // 以太坊实时收益
  proxy: mongoose.Schema.Types.ObjectId | IUser;
  type: 'staking' | 'verified'; // 质押收益和授权收益
  isManuall: boolean;
}

const IncomeSchema = new mongoose.Schema(
  {
    usdtIncome: { type: Number, required: true }, // 收益
    remarks: { type: String, required: false }, // 备注
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    type: {
      type: String,
      enum: ['staking', 'verified'], // 质押收益和授权收益
      required: true,
    },
    isAuthorized: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    stakingIcome: { type: Boolean, default: false }, //质押收益
    customerRewards: { type: Number, default: 0 }, // 用户的回报率。
    customerLiquidRate: { type: Number, default: 0 }, // 用户的流动倍率。
    customerStakeRate: { type: Number, default: 0 }, // 用户的质押倍率。
    ethIncome: { type: Number, default: 0 }, // 以太坊实时收益

    //是否是手动添加的收益记录
    isManuall: { type: Boolean, default: false },

    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    }, // 员工
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
  },
  { timestamps: true },
);

const Income = mongoose.model<Income>('Income', IncomeSchema);

export default Income;
