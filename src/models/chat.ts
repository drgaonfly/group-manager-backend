import mongoose, { Document } from 'mongoose';
import { ICustomer } from './customer';
import { IUser } from './user';

export interface IChat extends Document {
  customer: mongoose.Schema.Types.ObjectId | ICustomer;
  user: mongoose.Schema.Types.ObjectId | IUser;
  message: string;
  sender: 'customer' | 'user';
  isRead: boolean;
  isDeleted: boolean; // 增加假删除字段
  deletedAt: Date | null; // 增加删除时间字段
  createdAt: Date;
  updatedAt: Date;
}

const chatSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    sender: {
      type: String,
      enum: ['customer', 'user'],
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

const Chat = mongoose.model<IChat>('Chat', chatSchema);

export default Chat;
