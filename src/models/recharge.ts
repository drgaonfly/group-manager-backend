import mongoose, { Document } from 'mongoose';
import { IBotUser } from './botUser';
import { IBot } from './bot';
import { IUser } from './user';

// 充值选项
export const chargeOptions = [
  { amount: 5, label: '5 USDT', callback: 'charge_5' },
  { amount: 10, label: '10 USDT', callback: 'charge_10' },
  { amount: 20, label: '20 USDT', callback: 'charge_20' },
  { amount: 50, label: '50 USDT', callback: 'charge_50' },
  { amount: 100, label: '100 USDT', callback: 'charge_100' },
  { amount: 300, label: '300 USDT', callback: 'charge_300' },
  { amount: 500, label: '500 USDT', callback: 'charge_500' },
  { amount: 1000, label: '1000 USDT', callback: 'charge_1000' },
  { amount: 2000, label: '2000 USDT', callback: 'charge_2000' },
  { amount: null, label: '自定义金额', callback: 'charge_custom' },
  { amount: null, label: '取消充值', callback: 'close' },
];

export interface IRecharge extends Document {
  id: string;
  bot: mongoose.Schema.Types.ObjectId | IBot;
  botUser: mongoose.Schema.Types.ObjectId | IBotUser;
  proxy: mongoose.Schema.Types.ObjectId | IUser;
  from?: string; // 发送地址
  to: string; // 接收地址
  amount: number; // 充值金额
  status: string;
  txHash?: string;
  usdt_balance_before: number; // 充值前余额
  usdt_balance_after: number; // 充值后余额
  createdAt: Date;
  updatedAt: Date;
  expiredAt: Date;
  transactionAt?: Date;
}

const rechargeSchema = new mongoose.Schema<IRecharge>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: false,
    },
    botUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      required: false,
    },
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'expired', 'cancelled'],
      default: 'pending',
    },
    txHash: { type: String, required: false },
    to: {
      type: String,
      required: true,
    },
    from: { type: String, required: false },
    amount: { type: Number, required: true, default: 0 },
    transactionAt: { type: Date, required: false },
    expiredAt: { type: Date, required: true },
    usdt_balance_before: { type: Number, required: false, default: 0 },
    usdt_balance_after: { type: Number, required: false, default: 0 },
  },
  {
    timestamps: true,
  },
);

rechargeSchema.index({ txHash: 1 }, { unique: true, sparse: true });

const Recharge = mongoose.model<IRecharge>('Recharge', rechargeSchema);

export default Recharge;
