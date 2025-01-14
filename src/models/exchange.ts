import mongoose, { Document } from 'mongoose';

import { IWallet } from './wallet';

export interface IExchange extends Document {
  wallet: mongoose.Schema.Types.ObjectId | IWallet;
  status: 'pending' | 'success' | 'fail';
  usdtBalanceOnPlatform: number;
  ethBalanceOnPlatform: number;
  balance: string;
  targetBalance: string;
  uniPrice: string;
  startAt: Date;
  completedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const exchangeSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'fail'],
      required: true,
    },
    usdtBalanceOnPlatform: { type: Number, required: true },
    ethEarningsOnPlatform: { type: Number, required: true },
    balance: { type: String, required: false },
    targetBalance: { type: String, required: false },
    uniPrice: { type: String, required: false },
    startAt: { type: Date, required: false },
    completedAt: { type: Date, required: false },
  },
  { timestamps: true },
);

const Exchange = mongoose.model<IExchange>('Exchange', exchangeSchema);

export default Exchange;
