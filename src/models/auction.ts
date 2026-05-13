import mongoose, { Document } from 'mongoose';
import { IUser } from './user';
import { IBotUser } from './botUser';

export interface IAuctionBid {
  botUser: mongoose.Schema.Types.ObjectId | IBotUser;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  bidAmount: number; // 出价金额
  bidTime: Date; // 出价时间
  isWinning: boolean; // 是否为当前最高价
}

export interface IAuction extends Document {
  proxy: mongoose.Schema.Types.ObjectId | IUser; // 代理用户
  bot: mongoose.Schema.Types.ObjectId; // 关联机器人
  creator?: mongoose.Schema.Types.ObjectId | IBotUser; // 创建者
  title: string;
  group: mongoose.Schema.Types.ObjectId; // 指定群组
  keywords: string[];
  startingPrice: number; // 起拍价
  minBidIncrement: number; // 最小加价幅度
  maxBidIncrement: number; // 最大加价幅度
  endTime: Date; // 结束时间
  auctionResult: string; // 竞价结果(textarea)
  isPinned: boolean; // 是否置顶

  // 通知内容
  notifyContent: string; // 竞拍活动通知内容

  // 结束通知内容
  endNotifyContent: string; // 竞拍结束通知内容

  // 出价记录
  bids: IAuctionBid[];

  // 状态
  status: 'pending' | 'ongoing' | 'completed'; // 待开始、进行中、已完成
  winner?: mongoose.Schema.Types.ObjectId | IBotUser; // 获胜者
  winningBid?: number; // 获胜出价
  completedAt?: Date; // 完成时间

  createdAt: Date;
  updatedAt: Date;
}

const auctionBidSchema = new mongoose.Schema(
  {
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
    bidAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    bidTime: {
      type: Date,
      default: Date.now,
    },
    isWinning: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const auctionSchema = new mongoose.Schema(
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
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
    },
    title: {
      type: String,
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    keywords: {
      type: [String],
      required: true,
      default: ['竞拍'],
    },
    startingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    minBidIncrement: {
      type: Number,
      required: true,
      min: 1,
    },
    maxBidIncrement: {
      type: Number,
      required: true,
      min: 1,
    },
    endTime: {
      type: Date,
      required: true,
    },
    auctionResult: {
      type: String,
      required: true,
    },
    isPinned: {
      type: Boolean,
      default: true,
    },
    notifyContent: {
      type: String,
      default: '',
    },
    endNotifyContent: {
      type: String,
      default: '',
    },
    bids: {
      type: [auctionBidSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['pending', 'ongoing', 'completed'],
      default: 'ongoing',
    },
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
    },
    winningBid: {
      type: Number,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

auctionSchema.index({ bot: 1, status: 1 });
auctionSchema.index({ group: 1, status: 1 });
auctionSchema.index({ bot: 1, group: 1, status: 1 }); // 新增：优化同群竞拍查询
auctionSchema.index({ proxy: 1 });
auctionSchema.index({ endTime: 1 });

const Auction = mongoose.model<IAuction>('Auction', auctionSchema);

export default Auction;
