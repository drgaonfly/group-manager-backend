import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IBotUser } from './botUser';
import { IUser } from './user';

// 群组接口定义
export interface IGroup extends Document {
  id: number;
  title: string;
  username?: string; // 群组/频道的用户名（如 @groupname 中的 groupname）
  type: string;
  proxy: mongoose.Types.ObjectId | IUser;
  bot: mongoose.Schema.Types.ObjectId | IBot;
  creator: mongoose.Schema.Types.ObjectId | IBotUser;
  operators: (mongoose.Schema.Types.ObjectId | IBotUser)[]; // 操作人数组
  exchange_rate?: number;
  fee_rate?: number;
  isOnline: boolean; // 是否在线，不用显示在后台
  botUsers: (mongoose.Schema.Types.ObjectId | IBotUser)[];

  startAt?: Date;
  unit?: string;

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
      unique: false,
    },
    // 群组名称
    title: {
      type: String,
      required: true,
      trim: true,
    },
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    // 群组/频道用户名（公开链接用，如 @groupname）
    username: {
      type: String,
      required: false,
      trim: true,
      default: '',
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
    // 群的owner
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      required: false,
    },
    // 群的administrators
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
    startAt: {
      type: Date,
    },
    unit: {
      type: String,
      default: 'USD',
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
