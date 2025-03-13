import mongoose, { Document } from 'mongoose';
import { ICustomer } from './customer';

export interface Income extends Document {
  usdtIncome: number;
  remarks?: string;
  customer: mongoose.Schema.Types.ObjectId | ICustomer;
  isAuthorized: boolean;
  isVerified: boolean;
  customerRewards: number;
  customerLiquidRate: number;
}

const IncomeSchema = new mongoose.Schema(
  {
    usdtIncome: { type: Number }, // 收益
    remarks: { type: String, required: false }, // 备注
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    isAuthorized: { type: Boolean, default: false }, // 授权收益
    isVerified: { type: Boolean, default: false }, // 模拟收益
    customerRewards: { type: Number, default: 0 }, // 用户的回报率。
    customerLiquidRate: { type: Number, default: 0 }, // 用户的流动倍率。
  },
  { timestamps: true },
);

const Income = mongoose.model<Income>('Income', IncomeSchema);

export default Income;
