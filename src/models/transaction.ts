import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IGroup } from './group';
import { IBotUser } from './botUser';
export interface ITransaction extends Document {
  id: string;
  bot: mongoose.Schema.Types.ObjectId | IBot;
  group: mongoose.Schema.Types.ObjectId | IGroup;
  botUser: mongoose.Schema.Types.ObjectId | IBotUser;
  amount: number;
  exchange_rate: number;
  fee_rate: number;
  type: string;
  usdt_amount: number;
}

const transactionSchema = new mongoose.Schema(
  {
    id: { type: String },
    bot: { type: mongoose.Schema.Types.ObjectId, ref: 'Bot', required: true },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    // 创建账单的机器人用户
    botUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      required: true,
    },
    amount: { type: Number, required: true },
    exchange_rate: { type: Number, required: true },
    fee_rate: { type: Number, required: true },
    type: { type: String, required: true, enum: ['deposit', 'withdraw'] },
    usdt_amount: { type: Number },
  },
  { timestamps: true },
);

const Transaction = mongoose.model<ITransaction>(
  'Transaction',
  transactionSchema,
);

export default Transaction;
