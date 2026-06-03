import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IGroup } from './group';

// 群验证接口定义
export interface IGroupVerify extends Document {
  bot: mongoose.Schema.Types.ObjectId | IBot;
  group: mongoose.Schema.Types.ObjectId | IGroup;
  question: string;
  asks: {
    name: string;
    isCorrect: boolean;
  }[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 群验证 Schema
const groupVerifySchema = new mongoose.Schema(
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
    question: {
      type: String,
      required: true,
      trim: true,
    },
    asks: [
      {
        name: {
          type: String,
          required: true,
        },
        isCorrect: {
          type: Boolean,
          required: true,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// 每个群组只能有一条验证配置
groupVerifySchema.index({ bot: 1, group: 1 }, { unique: true });

const GroupVerify = mongoose.model<IGroupVerify>(
  'GroupVerify',
  groupVerifySchema,
);

export default GroupVerify;
