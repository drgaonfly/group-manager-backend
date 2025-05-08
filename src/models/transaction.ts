import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IUser } from './user';

export interface ITransaction extends Document {
  id: string;
  bot: mongoose.Schema.Types.ObjectId | IBot;
  amount: number;
  exchange_rate: number;
  fee_rate: number;
  to_user: mongoose.Schema.Types.ObjectId | IUser;
  type: string;
}

const transactionSchema = new mongoose.Schema(
  {
    id: { type: String },
    bot: { type: mongoose.Schema.Types.ObjectId, ref: 'Bot', required: true },
    amount: { type: Number, required: true },
    exchange_rate: { type: Number, required: false },
    fee_rate: { type: Number, required: false },
    to_user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    type: { type: String, required: true, enum: ['deposit', 'withdraw'] },
  },
  { timestamps: true },
);

const Transaction = mongoose.model<ITransaction>(
  'Transaction',
  transactionSchema,
);

export default Transaction;
