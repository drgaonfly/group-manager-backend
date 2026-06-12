import mongoose, { Document } from 'mongoose';

// 群欢迎接口定义
export interface IGroupWelcome extends Document {
  bot: mongoose.Schema.Types.ObjectId; // 关联机器人
  group: mongoose.Schema.Types.ObjectId; // 关联群组（按群配置）
  contents: string[];
  caption?: string;
  medias: string[];
  menus: {
    name: string;
    url: string;
  }[];
  deleteAfterSeconds?: number; // 阅后即焚：发送后多少秒自动删除
  pinNewMember?: boolean; // 是否置顶新成员
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
