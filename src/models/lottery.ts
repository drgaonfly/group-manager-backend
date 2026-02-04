import mongoose, { Document } from 'mongoose';
import { IUser } from './user';
import { IBotUser } from './botUser';

export interface ILotteryPrize {
  name: string;
  value: number; // 积分数量
  quantity: number;
}

export interface INotifyButton {
  name: string;
  url: string;
  row: number;
}

export interface IFixedWinner {
  botUser: mongoose.Schema.Types.ObjectId | IBotUser;
  prizeIndex: number; // 指定中哪个奖品（对应prizes数组索引）
}

export interface ILottery extends Document {
  proxy: mongoose.Schema.Types.ObjectId | IUser; // 代理用户
  bot: mongoose.Schema.Types.ObjectId; // 关联机器人
  creator?: mongoose.Schema.Types.ObjectId | IBotUser; // 创建者
  code: string; // 唯一参与码，用于生成参与链接
  title: string;
  keywords: string[];
  notifyContent: string; // 抽奖活动通知内容
  notifyButtons: INotifyButton[]; // 抽奖通知按钮
  notifyPin: boolean; // 抽奖活动通知是否置顶
  media?: string; // 媒体文件URL（图片或视频）
  mediaType?: 'image' | 'video'; // 媒体类型
  joinSuccessContent: string; // 成功参与通知内容
  joinSuccessButtons: INotifyButton[]; // 成功参与通知按钮
  joinSuccessPin: boolean; // 成功参与通知是否置顶
  drawResultContent: string; // 开奖通知内容
  drawResultButtons: INotifyButton[]; // 开奖通知按钮
  drawResultPin: boolean; // 开奖通知是否置顶
  drawMethod: ('fullParticipants' | 'scheduledTime')[]; // 开奖方式
  fullParticipantsCount?: number; // 满人开奖人数
  scheduledDrawTime?: Date; // 定时开奖时间
  prizes: ILotteryPrize[];
  fixedWinners: IFixedWinner[]; // 内定中奖用户
  isOnline: boolean;
  status: 'pending' | 'ongoing' | 'completed'; // 待开始、进行中、已完成
  drawnAt?: Date; // 开奖时间
  createdAt: Date;
  updatedAt: Date;
}

const lotteryPrizeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false },
);

const notifyButtonSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    row: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
  },
  { _id: false },
);

const fixedWinnerSchema = new mongoose.Schema(
  {
    botUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      required: true,
    },
    prizeIndex: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { _id: false },
);

const lotterySchema = new mongoose.Schema(
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
    code: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
    },
    keywords: {
      type: [String],
      required: true,
      default: ['抽奖'],
    },
    notifyContent: {
      type: String,
      default: '',
    },
    notifyButtons: {
      type: [notifyButtonSchema],
      default: [],
    },
    notifyPin: {
      type: Boolean,
      default: false,
    },
    media: {
      type: String,
    },
    mediaType: {
      type: String,
      enum: ['image', 'video'],
    },
    joinSuccessContent: {
      type: String,
      default: '',
    },
    joinSuccessButtons: {
      type: [notifyButtonSchema],
      default: [],
    },
    joinSuccessPin: {
      type: Boolean,
      default: false,
    },
    drawResultContent: {
      type: String,
      default: '',
    },
    drawResultButtons: {
      type: [notifyButtonSchema],
      default: [],
    },
    drawResultPin: {
      type: Boolean,
      default: false,
    },
    drawMethod: {
      type: [String],
      enum: ['fullParticipants', 'scheduledTime'],
      required: true,
    },
    fullParticipantsCount: {
      type: Number,
      min: 1,
    },
    scheduledDrawTime: {
      type: Date,
    },
    prizes: {
      type: [lotteryPrizeSchema],
      default: [],
    },
    fixedWinners: {
      type: [fixedWinnerSchema],
      default: [],
    },
    isOnline: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['pending', 'ongoing', 'completed'],
      default: 'ongoing',
    },
    drawnAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

lotterySchema.index({ bot: 1, status: 1 });
lotterySchema.index({ proxy: 1 });
lotterySchema.index({ code: 1 });

const Lottery = mongoose.model<ILottery>('Lottery', lotterySchema);

export default Lottery;
