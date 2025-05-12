import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IBotUser } from './botUser';
// 群组接口定义
export interface IGroup extends Document {
  id: number;
  title: string;
  type: string;
  bot: mongoose.Schema.Types.ObjectId | IBot;
  creator: mongoose.Schema.Types.ObjectId | IBotUser;
  operators: (mongoose.Schema.Types.ObjectId | IBotUser)[]; // 操作人数组
  exchange_rate?: number;
  fee_rate?: number;
  isOnline: boolean; // 是否在线，不用显示在后台
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
      enum: ['group'],
      default: 'group',
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
  },
  {
    timestamps: true,
  },
);

const Group = mongoose.model<IGroup>('Group', groupSchema);

export default Group;
