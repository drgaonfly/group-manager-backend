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
