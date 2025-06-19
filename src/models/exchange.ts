import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IBotUser } from './botUser';

// 交易接口定义
export interface IExchange extends Document {
  id: string;
  bot: mongoose.Schema.Types.ObjectId | IBot;
  botUser: mongoose.Schema.Types.ObjectId | IBotUser;
  from_address: string;
  to_address: string;
  receive_address: string;
  from_amount: number; // 被兑换的金额
  to_amount: number; // 需兑换的金额
  rate: number; // 兑换时的汇率
  fee: number; // 兑换时的手续费
  status: string; // 兑换状态
  hash: string; // 兑换时的哈希
  isTransferIntoOther: boolean; // 是否是转账到其他人
  createdAt: Date;
  updatedAt: Date;
  expiredAt: Date;
}

// 交易 Schema
const exchangeSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
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
    from_address: {
      type: String,
      required: true,
    }, // 机器人自动兑换地址, 收 U 地址
    to_address: {
      type: String,
      required: false,
    }, // 转账地址
    receive_address: {
      type: String,
      required: false,
    }, // 接收兑换 TRX 的地址
    from_amount: {
      type: Number,
      required: true,
    },
    to_amount: {
      type: Number,
      required: true,
    },
    rate: {
      type: Number,
      required: true,
    },
    fee: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'completed', 'failed', 'expired', 'temporary'],
    },
    hash: {
      type: String,
      required: false,
    },
    isTransferIntoOther: {
      type: Boolean,
      default: false,
    },
    expiredAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

const Exchange = mongoose.model<IExchange>('Exchange', exchangeSchema);

export default Exchange;
