import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IBotUser } from './botUser';
import { IUser } from './user';

// 群组接口定义
export interface IGroup extends Document {
  id: number;
  title: string;
  type: string;
  proxy: mongoose.Types.ObjectId | IUser;
  bot: mongoose.Schema.Types.ObjectId | IBot;
  creator: mongoose.Schema.Types.ObjectId | IBotUser;
  operators: (mongoose.Schema.Types.ObjectId | IBotUser)[]; // 操作人数组
  exchange_rate?: number;
  fee_rate?: number;
  isOnline: boolean; // 是否在线，不用显示在后台
  botUsers: (mongoose.Schema.Types.ObjectId | IBotUser)[];
  mutedUsers: number[]; // 被禁言的用户 Telegram ID 列表
  pendingVerifyUsers: number[]; // 待验证的用户 Telegram ID 列表
  startAt?: Date;
  unit?: string;
  message: string;
  intervalTime: number; // 间隔时间
  updatedAt: Date;
  createdAt: Date;
}

// 群组 Schema
const groupSchema = new mongoose.Schema(
  {
    // ID
    id: {
      type: Number,
      required: true,
      unique: true,
    },
    // 群组名称
    title: {
      type: String,
      required: true,
      trim: true,
    },
    // 群组类型，不用显示在后台
    type: {
      type: String,
      required: true,
      default: 'supergroup',
    },
    // 所属机器人
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
    },
    // 认证者或创建者
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      required: true,
    },
    // 操作人
    operators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BotUser',
        required: false,
      },
    ],
    // 汇率
    exchange_rate: {
      type: Number,
      required: false,
      default: 1, // USDT默认汇率为1
    },
    // 费率
    fee_rate: {
      type: Number,
      required: false,
      default: 0, // 默认费率为0%
    },
    // 是否在线
    isOnline: {
      type: Boolean,
      required: false,
      default: false,
    },
    botUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BotUser',
      },
    ],
    // 被禁言的用户 Telegram ID 列表
    mutedUsers: [
      {
        type: Number,
      },
    ],
    // 待验证的用户 Telegram ID 列表
    pendingVerifyUsers: [
      {
        type: Number,
      },
    ],
    startAt: {
      type: Date,
    },
    unit: {
      type: String,
      default: 'USD',
    },
    message: {
      type: String,
      required: false,
    },
    intervalTime: {
      type: Number,
      required: false,
      default: 0,
    },
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

groupSchema.virtual('transactions', {
  ref: 'Transaction', // 关联的模型
  localField: '_id', // Group 的 `_id`
  foreignField: 'group', // Transaction 中的 `group` 字段
});

const Group = mongoose.model<IGroup>('Group', groupSchema);

export default Group;
