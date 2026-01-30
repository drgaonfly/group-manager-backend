import mongoose, { Document } from 'mongoose';
import { IUser } from './user';
import { IBot } from './bot';

// 签到类型
export type CheckinRuleType =
  | 'first' // 初次签到
  | 'daily'; // 每日签到

export interface ICheckinRule extends Document {
  proxy: mongoose.Schema.Types.ObjectId | IUser;
  bot: mongoose.Schema.Types.ObjectId | IBot;
  type: CheckinRuleType;
  reward: number; // 基础积分数量
  keywords: string[]; // 触发关键词
  success_content: string; // 签到成功提示
  isOnline: boolean;
}

const checkinRuleSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ['first', 'daily'],
      required: true,
    },
    reward: { type: Number, default: 10, min: 1 },
    success_content: { type: String, default: '' },
    keywords: { type: [String], required: true, default: ['签到'] },
    isOnline: { type: Boolean, default: true },
  },
  { timestamps: true },
);

checkinRuleSchema.index({ proxy: 1 });

const CheckinRule = mongoose.model<ICheckinRule>(
  'CheckinRule',
  checkinRuleSchema,
);

export default CheckinRule;
