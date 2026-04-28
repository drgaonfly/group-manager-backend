import mongoose, { Document, Schema } from 'mongoose';
import { IBot } from './bot';
import { IUser } from './user';

// 子文档类型：关键词
interface IKeyword {
  content: string;
  isFuzzy: boolean;
}

// 主接口
export interface IAdRemoval extends Document {
  bot: mongoose.Types.ObjectId | IBot;
  proxy: mongoose.Types.ObjectId | IUser;
  name: string;
  remark?: string;

  keywords: IKeyword[];
  isOnline: boolean;

  mode: 'any' | 'all';
}

// 关键词 Schema（单独拆出来更干净）
const keywordSchema = new Schema<IKeyword>(
  {
    content: {
      type: String,
      required: true,
      trim: true,
    },
    isFuzzy: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }, // 不需要单独 _id
);

// 主 Schema
const adRemovalSchema = new Schema<IAdRemoval>(
  {
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
      index: true,
    },
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    remark: {
      type: String,
      trim: true,
    },

    keywords: {
      type: [keywordSchema],
      default: [],
    },

    isOnline: {
      type: Boolean,
      default: true,
      index: true,
    },

    mode: {
      type: String,
      enum: ['any', 'all'],
      default: 'any',
    },
  },
  {
    timestamps: true,
  },
);

adRemovalSchema.index({ bot: 1, isOnline: 1 });
adRemovalSchema.index({ proxy: 1, isOnline: 1 });

// Model
const AdRemoval = mongoose.model<IAdRemoval>('AdRemoval', adRemovalSchema);

export default AdRemoval;
