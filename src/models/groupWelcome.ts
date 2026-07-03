import mongoose, { Document } from 'mongoose';
import { IMenu, menuSchema } from './groupMessage';

// 群欢迎接口定义
export interface IGroupWelcome extends Document {
  bot: mongoose.Schema.Types.ObjectId;
  group: mongoose.Schema.Types.ObjectId;
  contents: string[];
  caption?: string;
  medias: string[];
  menus: IMenu[];
  deleteAfterSeconds?: number;
  pinNewMember?: boolean;
}

// 群欢迎 Schema
const groupWelcomeSchema = new mongoose.Schema(
  {
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
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
    menus: [menuSchema],
    deleteAfterSeconds: {
      type: Number,
      required: false,
      default: 0, // 0 表示不删除
      min: 0,
    },
    pinNewMember: {
      type: Boolean,
      required: false,
      default: false, // 默认不置顶
    },
  },
  {
    timestamps: true,
  },
);

// 同一个 bot + group 只能有一条欢迎配置
groupWelcomeSchema.index({ bot: 1, group: 1 }, { unique: true });
groupWelcomeSchema.index({ bot: 1 });

const GroupWelcome = mongoose.model<IGroupWelcome>(
  'GroupWelcome',
  groupWelcomeSchema,
);

export default GroupWelcome;
