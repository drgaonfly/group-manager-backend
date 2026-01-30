import mongoose, { Document } from 'mongoose';
import { IUser } from './user';
import { IBot } from './bot';

// 签到类型
export type SignRuleType =
  | 'firstSign' // 初次签到
  | 'dailySign' // 每日签到
  | 'consecutiveSign' // 连续签到
  | 'accumulatedSign'; // 累计签到

// 连续/累计签到的积分阶梯
export interface ISignTier {
  days: number; // 天数
  points: number; // 积分
}

export interface ISignRule extends Document {
  proxy: mongoose.Schema.Types.ObjectId | IUser;
  bot: mongoose.Schema.Types.ObjectId | IBot;
  type: SignRuleType;
  points: number; // 基础积分数量
  signTiers: ISignTier[]; // 签到阶梯
  signPeriod: string; // 周期
  successContent: string; // 签到成功提示
  keywords: string[]; // 触发关键词
  isOnline: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const signTierSchema = new mongoose.Schema(
  {
    days: { type: Number, required: true, min: 1 },
    points: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const signRuleSchema = new mongoose.Schema(
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
      enum: ['firstSign', 'dailySign', 'consecutiveSign', 'accumulatedSign'],
      required: true,
    },
    points: { type: Number, default: 10, min: 1 },
    signTiers: { type: [signTierSchema], default: [] },
    signPeriod: {
      type: String,
      enum: ['day', 'week', 'month'],
      default: 'week',
    },
    successContent: { type: String, default: '' },
    keywords: { type: [String], required: true, default: ['签到'] },
    isOnline: { type: Boolean, default: true },
  },
  { timestamps: true },
);

signRuleSchema.index({ group: 1, type: 1 });
signRuleSchema.index({ proxy: 1 });

// 使用相同的 collection 名称以保持数据兼容
const SignRule = mongoose.model<ISignRule>('PointsRule', signRuleSchema);

export default SignRule;
