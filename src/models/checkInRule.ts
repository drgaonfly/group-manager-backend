import mongoose, { Document } from 'mongoose';
import { IUser } from './user';
import { IBot } from './bot';
import { IGroup } from './group';

// 签到类型
export type CheckinRuleType =
  | 'first' // 初次签到
  | 'daily'; // 每日签到

// 连续签到周期配置
export interface IStreakCycle {
  days: number; // 连续天数
  multiplier: number; // 倍率
}

export interface ICheckinRule extends Document {
  proxy: mongoose.Schema.Types.ObjectId | IUser;
  bot: mongoose.Schema.Types.ObjectId | IBot;
  group?: mongoose.Schema.Types.ObjectId | IGroup; // 关联群组，可选；不填则作为 bot 级默认规则
  type: CheckinRuleType;
  reward: number; // 基础积分数量
  keywords: string[]; // 触发关键词
  success_content: string; // 签到成功提示
  isOnline: boolean;
  // 连续签到配置
  enableStreakBonus: boolean; // 是否启用连续签到奖励
  streakCycles: IStreakCycle[]; // 连续签到周期配置
  maxMultiplier: number; // 最高倍率限制
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
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: false,
      default: null,
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
    // 连续签到配置
    enableStreakBonus: { type: Boolean, default: false },
    streakCycles: {
      type: [
        {
          days: { type: Number, required: true, min: 1 },
          multiplier: { type: Number, required: true, min: 1 },
        },
      ],
      default: [
        { days: 3, multiplier: 2 },
        { days: 5, multiplier: 3 },
        { days: 10, multiplier: 4 },
      ],
    },
    maxMultiplier: { type: Number, default: 4, min: 1 },
  },
  { timestamps: true },
);

// 每个群组只能有一条签到规则；group 为 null 时视为 bot 级默认规则，同样唯一
// sparse: true 让 null 值不受唯一约束（允许同一 bot 有且仅有一条默认规则需在应用层保证）
checkinRuleSchema.index({ bot: 1, group: 1 }, { unique: true, sparse: true });

const CheckinRule = mongoose.model<ICheckinRule>(
  'CheckinRule',
  checkinRuleSchema,
);

export default CheckinRule;
