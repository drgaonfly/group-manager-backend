import mongoose, { Document } from 'mongoose';
import { IUser } from './user';
import { IBot } from './bot';
import { IGroup } from './group';

// 频道推广接口定义
export interface IChannelPost extends Document {
  title?: string; // 保留用于兼容旧数据
  url?: string; // 保留用于兼容旧数据
  channel?: mongoose.Schema.Types.ObjectId | IGroup; // 保留用于兼容旧数据（单个频道）
  channels?: (mongoose.Schema.Types.ObjectId | IGroup)[]; // 关联的多个频道 Group
  content: string;
  medias: string[]; // 媒体文件（图片、视频等）
  menus: {
    name: string;
    url: string;
  }[];
  weight: number;
  interval: number; // 发送间隔时间（单位：分钟）
  lastPostTime?: Date; // 上次发送时间
  lastPostMessageId?: number; // 上次发送的消息ID
  isClearLastPost: boolean; // 是否清除上一条消息
  isOnline: boolean; // 是否启用定时发送
  startAt?: Date; // 发送时间窗口开始
  endAt?: Date; // 发送时间窗口结束
  proxy: mongoose.Schema.Types.ObjectId | IUser;
  bot: mongoose.Schema.Types.ObjectId | IBot;
}

// 频道推广 Schema
const channelPostSchema = new mongoose.Schema(
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
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: false, // 保留用于兼容旧数据
    },
    channels: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
      },
    ],
    content: {
      type: String,
      required: false,
      trim: true,
    },
    medias: {
      type: [String],
      default: [],
    },
    menus: [
      {
        name: String,
        url: String,
      },
    ],
    title: {
      type: String,
      required: false,
      trim: true,
    },
    url: {
      type: String,
      required: false,
      trim: true,
    },
    weight: {
      type: Number,
      default: 0,
    },
    interval: {
      type: Number,
      default: 1, // 默认1分钟
    },
    lastPostTime: {
      type: Date,
      required: false,
    },
    lastPostMessageId: {
      type: Number,
      required: false,
    },
    isClearLastPost: {
      type: Boolean,
      default: false,
    },
    isOnline: {
      type: Boolean,
      default: true,
    },
    startAt: {
      type: Date,
      required: false,
    },
    endAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

const ChannelPost = mongoose.model<IChannelPost>(
  'ChannelPost',
  channelPostSchema,
);

export default ChannelPost;
