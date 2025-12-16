import mongoose, { Document } from 'mongoose';

// 群验证接口定义
export interface IGroupVerify extends Document {
  question: string;
  asks: {
    name: string;
    isCorrect: boolean;
  }[];
}

// 群验证 Schema
const groupVerifySchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true, // 验证问题一般是必须的
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
  },
  {
    timestamps: true,
  },
);

const GroupVerify = mongoose.model<IGroupVerify>(
  'GroupVerify',
  groupVerifySchema,
);

export default GroupVerify;
