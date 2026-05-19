import mongoose, { Document } from 'mongoose';
import { IBotUser } from './botUser';
import { IBot } from './bot';
import { IUser } from './user';

// 积分继承记录接口定义
export interface ISuccess extends Document {
  bot: mongoose.Types.ObjectId | IBot;
  proxy: mongoose.Types.ObjectId | IUser;
  // 继承码持有人（来源账号）
  botUser: mongoose.Types.ObjectId | IBotUser;
  code: string;
  // 继承状态
  used: boolean;
  // 继承目标账号
  targetBotUser?: mongoose.Types.ObjectId | IBotUser;
  // 继承前来源余额
  amountBefore?: number;
  // 继承后来源余额（清零后为 0）
  amountAfter?: number;
  // 继承完成时间
  usedAt?: Date;
}

// Success Schema
const successSchema = new mongoose.Schema(
  {
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
    },
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    botUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      required: false,
    },
    code: {
      type: String,
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
    targetBotUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      required: false,
    },
    amountBefore: {
      type: Number,
      required: false,
    },
    amountAfter: {
      type: Number,
      default: 0,
      required: false,
    },
    usedAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

const Success = mongoose.model<ISuccess>('Success', successSchema);

export default Success;
