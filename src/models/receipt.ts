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
      unique: true,
    },
    time: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

const Receipt = mongoose.model<IReceipt>('Receipt', receiptSchema);

export default Receipt;
