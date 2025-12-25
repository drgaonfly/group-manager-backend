import mongoose, { Document } from 'mongoose';
import { IGroup } from './group';
import { IChannelPost } from './channelPost';
import { IBot } from './bot';
import { IUser } from './user';

// 频道推广发送历史接口定义
export interface IChannelPostHistory extends Document {
  channelPost: mongoose.Types.ObjectId | IChannelPost;
  bot: mongoose.Types.ObjectId | IBot;
  proxy: mongoose.Types.ObjectId | IUser;
  channel: mongoose.Types.ObjectId | IGroup;
  channelId: string | number; // Telegram 频道 ID
  messageId?: number; // Telegram 消息 ID
  content: string;
  medias?: string[];
  status: 'success' | 'failed';
  errorMessage?: string;
  sentAt: Date;
}

// 频道推广发送历史 Schema
const channelPostHistorySchema = new mongoose.Schema(
  {
    channelPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChannelPost',
      required: true,
    },
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
    },
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: false,
    },
    channelId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    messageId: {
      type: Number,
      required: false,
    },
    content: {
      type: String,
      required: false,
    },
    medias: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      required: true,
    },
    errorMessage: {
      type: String,
      required: false,
    },
    sentAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// 索引
channelPostHistorySchema.index({ channelPost: 1, sentAt: -1 });
channelPostHistorySchema.index({ bot: 1, sentAt: -1 });
channelPostHistorySchema.index({ channel: 1, sentAt: -1 });

const ChannelPostHistory = mongoose.model<IChannelPostHistory>(
  'ChannelPostHistory',
  channelPostHistorySchema,
);

export default ChannelPostHistory;
