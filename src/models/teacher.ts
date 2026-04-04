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
  contactLink: string; // 修正拼写: contact_link
  address: string;

  isAvailable: boolean; // 建议将 isClass (是否上课) 改为 isAvailable (是否营业/接单中) 更符合语义
  reviews: string[];

  images: string[];
  videos: string[];

  brief: string;

  status: string;
  remark: string;
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
    contactLink: { type: String, required: true }, // 修正拼写
    address: { type: String, required: true },
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
  },
  {
    timestamps: true,
  },
);

// 保持索引逻辑：确保同一个 Bot 下的同一个 BotUser 唯一
teacherSchema.index({ bot: 1, botUser: 1 }, { unique: true });

const Teacher = mongoose.model<ITeacher>('Teacher', teacherSchema);

export default Teacher;
