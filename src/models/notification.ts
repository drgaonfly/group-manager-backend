import mongoose, { Document } from 'mongoose';
import { IUser } from './user'; // 假设你有一个 User 模型

export interface INotification extends Document {
  id: string;
  title: string;
  content: string;
  sender: mongoose.Schema.Types.ObjectId | IUser; // 发送者（关联 User）
  receiver: mongoose.Schema.Types.ObjectId | IUser; // 接收者（关联 User）
  createdAt?: Date; // 创建时间
  updatedAt?: Date; // 更新时间
}

const notificationSchema = new mongoose.Schema(
  {
    id: { type: String, required: false },
    title: { type: String, required: false },
    content: { type: String, required: false },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

const Notification = mongoose.model<INotification>(
  'Notification',
  notificationSchema,
);

export default Notification;
