import mongoose, { Document, Schema } from 'mongoose';
import { IBot } from './bot';

export interface IChat extends Document {
  chatId: number; // 聊天ID
  bot: IBot | string; // 关联的机器人
  type: 'private' | 'group' | 'supergroup' | 'channel'; // 聊天类型
  title?: string; // 标题
  username?: string; // 用户名
  createdAt?: Date; // 创建时间
  updatedAt?: Date; // 更新时间
  isOnline: boolean; // 是否在线
}

const chatSchema = new mongoose.Schema(
  {
    isOnline: { type: Boolean, required: true, default: false },
    chatId: {
      type: Number,
      required: true,
      comment: '聊天ID',
    },
    bot: {
      type: Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
      comment: '关联的机器人',
    },
    type: {
      type: String,
      enum: ['private', 'group', 'supergroup', 'channel'],
      required: true,
      comment: '聊天类型',
    },
    title: {
      type: String,
      required: false,
      comment: '标题',
    },
    username: {
      type: String,
      required: false,
      comment: '用户名',
    },
  },
  { timestamps: true },
);

const Chat = mongoose.model<IChat>('Chat', chatSchema);

export default Chat;
