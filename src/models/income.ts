import mongoose, { Document } from 'mongoose';
import { IWallet } from './wallet';
import { IUser } from './user';

export interface Income extends Document {
  wallet: mongoose.Schema.Types.ObjectId | IWallet;
  usdtEarnings: number;
  ethEarnings: number;
  type: 'flowing' | 'staking' | 'teamworking';
  remarks?: string;
  sharedCustomer: mongoose.Schema.Types.ObjectId | IUser;
  createdAt?: Date;
  updatedAt?: Date;
}

const IncomeSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
    },
    usdtEarnings: { type: Number },
    ethEarnings: { type: Number },
    type: {
      type: String,
      enum: ['flowing', 'staking', 'teamworking'],
      required: true,
    },
    remarks: { type: String, required: false },
    sharedCustomer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
  },
  { timestamps: true },
);

const Income = mongoose.model<Income>('Instruction', IncomeSchema);

export default Income;
