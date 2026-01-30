import mongoose, { Document } from 'mongoose';

// 群欢迎接口定义
export interface IGroupWelcome extends Document {
  contents: string[];
  caption?: string;
  medias: string[];
  menus: {
    name: string;
    url: string;
  }[];
  deleteAfterSeconds?: number; // 阅后即焚：发送后多少秒自动删除
}

// 群欢迎 Schema
const groupWelcomeSchema = new mongoose.Schema(
  {
    contents: {
      type: [String],
      required: false,
      trim: true,
    },
    caption: {
      type: String,
      required: false,
      trim: true,
    },
    medias: {
      type: [String],
      required: false,
    },
    menus: [
      {
        name: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
      },
    ],
    deleteAfterSeconds: {
      type: Number,
      required: false,
      default: 0, // 0 表示不删除
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

const GroupWelcome = mongoose.model<IGroupWelcome>(
  'GroupWelcome',
  groupWelcomeSchema,
);

export default GroupWelcome;
