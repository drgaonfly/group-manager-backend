import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IBotUser } from './botUser';
import { SpeechRewardCycle } from './speechConfig';

/**
 * 记录每个用户在某个周期内已获得即时发言奖励的次数
 * 用于判断是否超过 speechRewardMaxTimes
 */
export interface ISpeechRewardLog extends Document {
  bot: mongoose.Types.ObjectId | IBot;
  botUser: mongoose.Types.ObjectId | IBotUser;
  cycle: SpeechRewardCycle;
  /** 周期起始时间（用于判断是否在同一周期内） */
  periodStart: Date;
  /** 本周期内已奖励次数 */
  rewardedTimes: number;
  /** 本周期内已奖励的总积分 */
  rewardedPoints: number;
  createdAt: Date;
  updatedAt: Date;
}

const speechRewardLogSchema = new mongoose.Schema<ISpeechRewardLog>(
  {
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
    cycle: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    rewardedTimes: { type: Number, default: 0, min: 0 },
    rewardedPoints: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// 每个用户在同一 bot + 同一周期起始时间只有一条记录
speechRewardLogSchema.index(
  { bot: 1, botUser: 1, periodStart: 1 },
  { unique: true },
);

const SpeechRewardLog = mongoose.model<ISpeechRewardLog>(
  'SpeechRewardLog',
  speechRewardLogSchema,
);

export default SpeechRewardLog;
