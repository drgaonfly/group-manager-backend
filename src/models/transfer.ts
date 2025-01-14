import mongoose, { Document } from 'mongoose';
import { IWallet } from './wallet';

export interface ITransfer extends Document {
  wallet: mongoose.Schema.Types.ObjectId | IWallet;
  receivingAddress: string;
  currency: 'USDT' | 'PledgeBalance';
  balance: number;
  type: 'collection' | 'staking' | 'profitSharing';
  remark: string;
  createdAt: Date;
  updatedAt: Date;
}

const transferSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
    },
    receivingAddress: { type: String, required: true },
    currency: {
      type: String,
      enum: ['USDT', 'PledgeBalance'],
      required: true,
    },
    balance: { type: Number, required: true },
    type: {
      type: String,
      enum: ['collection', 'staking', 'profitSharing'],
      required: true,
    },
    remark: { type: String, required: false },
  },
  { timestamps: true },
);

const Transfer = mongoose.model<ITransfer>('Transfer', transferSchema);

export default Transfer;
