import mongoose, { Document } from 'mongoose';
import { ILottery } from './lottery';
import { IBotUser } from './botUser';

export interface ILotteryParticipant extends Document {
  lottery: mongoose.Schema.Types.ObjectId | ILottery;
  botUser: mongoose.Schema.Types.ObjectId | IBotUser;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  messageCount: number; // 参与时的发言数量
  isWinner: boolean;
  isFixed?: boolean; // 是否为内定中奖
  prizeIndex?: number; // 中奖的奖品索引
  prizeName?: string; // 中奖的奖品名称
  prizeValue?: number | string; // 中奖的奖品值
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const lotteryParticipantSchema = new mongoose.Schema(
  {
    lottery: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lottery',
      required: true,
    },
    botUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      required: true,
    },
    telegramId: {
      type: Number,
      required: true,
    },
    username: {
      type: String,
    },
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    messageCount: {
      type: Number,
      required: true,
    },
    isWinner: {
      type: Boolean,
      default: false,
    },
    isFixed: {
      type: Boolean,
      default: false,
    },
    prizeIndex: {
      type: Number,
    },
    prizeName: {
      type: String,
    },
    prizeValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

lotteryParticipantSchema.index({ lottery: 1, botUser: 1 }, { unique: true });
lotteryParticipantSchema.index({ lottery: 1, isWinner: 1 });

const LotteryParticipant = mongoose.model<ILotteryParticipant>(
  'LotteryParticipant',
  lotteryParticipantSchema,
);

export default LotteryParticipant;
