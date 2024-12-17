import mongoose, { Document } from 'mongoose';

export interface IMessage extends Document {
  _id: string;
  messageId: string;
  botName: string;
  chatGroup: string;
  sender: string;
  content: string;
  messageType: string;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    messageId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    botName: {
      type: String,
      required: true,
      trim: true,
    },
    chatGroup: {
      type: String,
      required: true,
      trim: true,
    },
    sender: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    messageType: {
      type: String,
      required: true,
      enum: ['text', 'photo', 'video', 'document', 'other'], // 消息类型枚举
      default: 'text',
    },
  },
  {
    timestamps: true,
  },
);

const Message = mongoose.model<IMessage>('Message', messageSchema);

export default Message;
