import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IGroup } from './group';

// 帖子接口定义
export interface IPost extends Document {
  bot: mongoose.Schema.Types.ObjectId | IBot; // 关联机器人
  source: mongoose.Schema.Types.ObjectId | IGroup; // 来源频道（Group）
  link: string; // 帖子链接
  title: string; // 帖子标题（来自文本第一行）
  messageId: number; // Telegram 消息 ID
}

// 帖子 Schema
const postSchema = new mongoose.Schema(
  {
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
    },
    source: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: false,
    },
    link: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    messageId: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// 同一个 bot 下不允许重复的帖子链接
postSchema.index({ bot: 1, link: 1 }, { unique: true });

const Post = mongoose.model<IPost>('Post', postSchema);

export default Post;
