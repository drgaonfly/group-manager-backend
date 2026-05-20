import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IGroup } from './group';
import { IUser } from './user';

export interface IPost extends Document {
  bot: mongoose.Schema.Types.ObjectId | IBot;
  source: mongoose.Schema.Types.ObjectId | IGroup;
  proxy: mongoose.Schema.Types.ObjectId | IUser;
  link: string;
  title: string;
  messageId: number;
}

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
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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

postSchema.index({ bot: 1, link: 1 }, { unique: true });

const Post = mongoose.model<IPost>('Post', postSchema);

export default Post;
