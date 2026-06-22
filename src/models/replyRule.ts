import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IUser } from './user';

export interface IReplyRuleMenu extends Document {
  name: string;
  url: string;
  row: number;
  style: 'primary' | 'success' | 'danger';
}

export const replyRuleMenuSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: {
    type: String,
    required: true,
    validate: {
      validator: function (v: string): boolean {
        return /^(http|https):\/\/.*/.test(v);
      },
      message: (props: any): string => `${props.value} 不是一个有效的 URL!`,
    },
  },
  row: { type: Number, required: false, default: 1 },
  style: {
    type: String,
    enum: ['primary', 'success', 'danger'],
    default: 'primary',
  },
});

// ReplyRule 关键词回复
export interface IReplyRule extends Document {
  proxy: mongoose.Schema.Types.ObjectId | IUser;
  bot: mongoose.Schema.Types.ObjectId | IBot;
  group: mongoose.Schema.Types.ObjectId; // 必须指定群组，只在该群触发
  keyword: string[];
  isFuzzy: boolean; // 是否模糊匹配（包含即触发）
  content: string;
  medias: string[];
  menus: IReplyRuleMenu[];
  menus_per_row: number;
  replyToMessage: boolean;
  replyToAdmin: boolean;
  deleteAfterSeconds: number;
  deleteUserMsgAfterSeconds: number;
  isOnline: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const replyRuleSchema = new mongoose.Schema(
  {
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
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
    keyword: {
      type: [String],
      required: true,
    },
    isFuzzy: {
      type: Boolean,
      required: false,
      default: false,
    },
    content: {
      type: String,
      required: true,
    },
    medias: {
      type: [String],
      required: false,
    },
    menus: [replyRuleMenuSchema],
    replyToMessage: {
      type: Boolean,
      required: false,
      default: false,
    },
    replyToAdmin: {
      type: Boolean,
      required: false,
      default: true,
    },
    deleteAfterSeconds: {
      type: Number,
      required: false,
      default: 0,
    },
    deleteUserMsgAfterSeconds: {
      type: Number,
      required: false,
      default: 0,
    },
    isOnline: {
      type: Boolean,
      required: false,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

replyRuleSchema.index({ bot: 1, group: 1, isOnline: 1 });
replyRuleSchema.index({ bot: 1, keyword: 1 });
replyRuleSchema.index({ proxy: 1, createdAt: -1 });

const ReplyRule = mongoose.model<IReplyRule>('ReplyRule', replyRuleSchema);

export default ReplyRule;
