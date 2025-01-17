import mongoose, { Document } from 'mongoose';
import { IUser } from './user';

export interface IWallet extends Document {
  user: mongoose.Schema.Types.ObjectId | IUser;
  network: 'TRX' | 'BSC' | 'ETH';
  type: 'USDT' | 'PledgeBalance';
  address: string;
  balance: number;
  aggragedBalance: number;
  stackedBalance: number;
  withdrawalBalance: number;
  secretKey: string;
}

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    network: {
      type: String,
      enum: ['TRX', 'BSC', 'ETH'],
      required: true,
    },
    type: {
      type: String,
      enum: ['USDT', 'PledgeBalance'],
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    balance: {
      type: Number,
      required: true,
    },
    aggragedBalance: {
      type: Number,
      required: false,
      default: 0,
    },
    stackedBalance: {
      type: Number,
      required: false,
      default: 0,
    },
    withdrawalBalance: {
      type: Number,
      required: false,
      default: 0,
    },
    secretKey: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);

export default Wallet;
