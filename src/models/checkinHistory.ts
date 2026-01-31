import mongoose, { Document } from 'mongoose';
import { IBotUser } from './botUser';
import { IUser } from './user';
import { IBot } from './bot';
import { IGroup } from './group';

// 签到类型
export type CheckinType =
  | 'first' // 初次签到
  | 'daily'; // 每日签到

export interface ICheckinHistory extends Document {
  proxy: mongoose.Schema.Types.ObjectId | IUser;
  bot: mongoose.Schema.Types.ObjectId | IBot;
  botUser: mongoose.Schema.Types.ObjectId | IBotUser;
  group: mongoose.Schema.Types.ObjectId | IGroup;
  type: CheckinType;
  reward: number; // 获得的积分数量
}

const checkinHistorySchema = new mongoose.Schema(
  {
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    type: {
      type: String,
      enum: ['first', 'daily'],
      required: true,
    },
    reward: { type: Number, default: 10, min: 1 },
  },
  { timestamps: true },
);

const CheckinHistory = mongoose.model<ICheckinHistory>(
  'CheckinHistory',
  checkinHistorySchema,
);

export default CheckinHistory;
