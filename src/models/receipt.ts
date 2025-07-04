import mongoose, { Document } from 'mongoose';
import { IWallet } from './wallet';
import { IBot } from './bot';
import { IBotUser } from './botUser';

// 收据接口定义
export interface IReceipt extends Document {
  id: string;
  wallet: mongoose.Schema.Types.ObjectId | IWallet;
  amount: number;
  hash: string;
  bot: mongoose.Schema.Types.ObjectId | IBot;
  botUser: mongoose.Schema.Types.ObjectId | IBotUser;
  time: number;
  type: string; // 转入还是转出
  from_address: string;
  to_address: string;
  crypto_type: string;
  createdAt: Date;
  updatedAt: Date;
}

// 收据 Schema
const receiptSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
    },
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
    },
    botUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    hash: {
      type: String,
      required: true,
    },
    time: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['transferIn', 'transferOut'],
    },
    from_address: {
      type: String,
      required: true,
    },
    to_address: {
      type: String,
      required: true,
    },
    crypto_type: {
      type: String,
      enum: ['usdt', 'trx'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// 添加联合索引: botUser, bot, wallet, hash
receiptSchema.index(
  { botUser: 1, bot: 1, wallet: 1, hash: 1 },
  { unique: true },
);

const Receipt = mongoose.model<IReceipt>('Receipt', receiptSchema);

export default Receipt;
