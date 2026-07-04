import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IUser } from './user';
import { IMenu, menuSchema } from './groupMessage';

// ReplyRule 关键词回复
export interface IReplyRule extends Document {
  proxy: mongoose.Schema.Types.ObjectId | IUser;
  bot: mongoose.Schema.Types.ObjectId | IBot;
  group: mongoose.Schema.Types.ObjectId;
  keyword: string[];
  isFuzzy: boolean;
  content: string;
  medias: string[];
  menus: IMenu[];
  menus_per_row: number;
  replyToMessage: boolean;
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
    menus: [menuSchema],
    replyToMessage: {
      type: Boolean,
      required: false,
      default: false,
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
