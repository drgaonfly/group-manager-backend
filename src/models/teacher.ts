import mongoose, { Document } from 'mongoose';
import { IBotUser } from './botUser';
import { IBot } from './bot';
import { IUser } from './user';

// Teacher（原 Bot和User的关系表）接口定义
export interface ITeacher extends Document {
  bot: mongoose.Types.ObjectId | IBot;
  proxy: mongoose.Types.ObjectId | IUser;
  botUser: mongoose.Types.ObjectId | IBotUser;

  display_name: string;
  contactLink: string;
  address: string;

  isAvailable: boolean;
  reviews: string[];

  images: string[];
  videos: string[];

  brief: string;

  status: string;
  remark: string;

  /** 群内发送「老师」列表消息后，多少秒自动删除（阅后即焚）；默认 30；0 表示不删除 */
  menuDeleteAfterSeconds?: number;
}

// Teacher Schema
const teacherSchema = new mongoose.Schema(
  {
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
    },
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    botUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      required: false,
    },
    contactLink: { type: String, required: false }, // 修正拼写
    address: { type: String, required: false },
    isAvailable: { type: Boolean, required: true, default: false }, // 原 isClass
    reviews: { type: [String], required: true, default: [] },
    images: { type: [String], required: true, default: [] },
    videos: { type: [String], required: true, default: [] },
    display_name: { type: String, required: true },
    brief: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    remark: { type: String, default: '' },
    menuDeleteAfterSeconds: { type: Number, default: 30 },
  },
  {
    timestamps: true,
  },
);

const Teacher = mongoose.model<ITeacher>('Teacher', teacherSchema);

export default Teacher;
