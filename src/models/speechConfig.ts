import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IUser } from './user';

export type SpeechRewardCycle = 'daily' | 'weekly' | 'monthly';

export interface ISpeechConfig extends Document {
  bot: mongoose.Types.ObjectId | IBot;
  proxy: mongoose.Types.ObjectId | IUser;

  // ── 基础统计 ──────────────────────────────────────────
  minSpeechLength: number; // 发言满 N 字才纳入统计
  allowPureNumberSpeech: boolean; // 是否允许纯数字发言纳入统计

  // ── 排行榜奖励（周期结束时发放，前 N 名） ────────────
  enableActivityReward: boolean;
  activityRewardCycle: SpeechRewardCycle;
  activityRewardTopN: number; // 奖励前 N 名
  activityRewardPoints: number; // 每人奖励积分

  // ── 即时发言奖励（发一条奖一次，周期内有上限） ───────
  enableSpeechReward: boolean;
  speechRewardCycle: SpeechRewardCycle;
  speechRewardPoints: number; // 每次发言奖励积分
  speechRewardMaxTimes: number; // 周期内最多奖励次数

  createdAt: Date;
  updatedAt: Date;
}

const speechConfigSchema = new mongoose.Schema<ISpeechConfig>(
  {
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
      unique: true, // 每个 bot 只有一份配置
    },
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // 基础统计
    minSpeechLength: { type: Number, default: 1, min: 1 },
    allowPureNumberSpeech: { type: Boolean, default: false },

    // 排行榜奖励
    enableActivityReward: { type: Boolean, default: false },
    activityRewardCycle: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'daily',
    },
    activityRewardTopN: { type: Number, default: 3, min: 1 },
    activityRewardPoints: { type: Number, default: 10, min: 1 },

    // 即时发言奖励
    enableSpeechReward: { type: Boolean, default: false },
    speechRewardCycle: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'daily',
    },
    speechRewardPoints: { type: Number, default: 1, min: 1 },
    speechRewardMaxTimes: { type: Number, default: 5, min: 1 },
  },
  { timestamps: true },
);

const SpeechConfig = mongoose.model<ISpeechConfig>(
  'SpeechConfig',
  speechConfigSchema,
);

export default SpeechConfig;
