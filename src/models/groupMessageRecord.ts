import mongoose, { Document } from 'mongoose';
import { IGroup } from './group';
import { IGroupMessage } from './groupMessage';
import { IBot } from './bot';
import { IUser } from './user';

// 群发消息发送记录接口定义
export interface IGroupMessageRecord extends Document {
  groupMessage: mongoose.Types.ObjectId | IGroupMessage;
  bot: mongoose.Types.ObjectId | IBot;
  proxy: mongoose.Types.ObjectId | IUser;
  group: mongoose.Types.ObjectId | IGroup;
  groupId: string | number; // Telegram 群组 ID
  messageId?: number; // Telegram 消息 ID
  content: string;
  medias?: string[];
  status: 'success' | 'failed';
  errorMessage?: string;
  sentAt: Date;
}

// 群发消息发送记录 Schema
const groupMessageRecordSchema = new mongoose.Schema(
  {
    groupMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GroupMessage',
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
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: false,
    },
    groupId: {
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
groupMessageRecordSchema.index({ groupMessage: 1, sentAt: -1 });
groupMessageRecordSchema.index({ bot: 1, sentAt: -1 });
groupMessageRecordSchema.index({ group: 1, sentAt: -1 });

const GroupMessageRecord = mongoose.model<IGroupMessageRecord>(
  'GroupMessageRecord',
  groupMessageRecordSchema,
);

export default GroupMessageRecord;
