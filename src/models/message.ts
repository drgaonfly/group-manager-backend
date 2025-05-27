import mongoose, { Document } from 'mongoose';
import { MessageType } from './botMessage';

// 消息接口定义
export interface IMessage extends Document {
  message_id: number; // Telegram 消息ID
  id: number; // 发送者id
  is_bot: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  chat_id: number; // 聊天id
  chat_type: string;
  chat_title?: string;
  date: number; // 消息时间戳（秒）
  messageType: string; // 消息类型，如 text, image, command 等
  content: string; // 消息内容
  raw?: any; // 原始消息体，可选
  botName?: string; // 新增 botName 字段
}

// 消息 Schema
const messageSchema = new mongoose.Schema(
  {
    message_id: {
      type: Number,
      required: true,
    },
    id: { type: Number, required: true }, // from.id
    is_bot: { type: Boolean, required: true, default: false }, // from.is_bot
    first_name: { type: String },
    last_name: { type: String },
    username: { type: String },
    language_code: { type: String },
    chat_id: { type: Number, required: true }, // chat.id
    chat_type: { type: String, required: true }, // chat.type
    chat_title: { type: String },
    date: {
      type: Number,
      required: true,
    },
    messageType: {
      type: String,
      required: true,
      enum: Object.values(MessageType),
      default: 'text',
    },
    content: {
      type: String,
      required: true,
    },
    raw: {
      type: mongoose.Schema.Types.Mixed,
    },
    botName: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

const Message = mongoose.model<IMessage>('Message', messageSchema);

export default Message;
