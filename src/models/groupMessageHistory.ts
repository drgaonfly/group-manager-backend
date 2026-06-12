import mongoose, { Document } from 'mongoose';
import { IGroup } from './group';
import { IGroupMessage } from './groupMessage';

// 群组消息历史接口定义
export interface IGroupMessageHistory extends Document {
  group: mongoose.Types.ObjectId | IGroup;
  lastSentMessage: mongoose.Types.ObjectId | IGroupMessage;
  lastSentMessageId?: number; // 上一条消息的 Telegram message_id，用于自动删除
  sentAt: Date;
}

// 群组消息历史 Schema
const groupMessageHistorySchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    lastSentMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GroupMessage',
      required: true,
    },
    lastSentMessageId: {
      type: Number,
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

const GroupMessageHistory = mongoose.model<IGroupMessageHistory>(
  'GroupMessageHistory',
  groupMessageHistorySchema,
);

export default GroupMessageHistory;
