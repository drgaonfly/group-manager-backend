import mongoose, { Document } from 'mongoose';

export interface IRecord extends Document {
  user: mongoose.Types.ObjectId; // 关联用户
  topic: mongoose.Types.ObjectId; // 关联到 Topic
  issue: string;
  status: string;
  answers: Array<{
    answer: mongoose.Types.ObjectId;
    count: number;
  }>;
}

const recordSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    topic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      required: true,
    },
    answers: [
      {
        answer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Answer',
        },
        count: {
          type: Number,
          default: 1,
        },
      },
    ],
    issue: {
      type: String,
      required: true,
      enum: [
        'No Issue',
        'Unfriendly Operation',
        'Recognition Error',
        'Video Error/Frame Loss',
      ],
      default: 'No Issue',
    },
    status: {
      type: String,
      required: true,
      default: 'pending',
      enum: ['pending', 'success', 'fail'],
    },
  },
  { timestamps: true },
);

const Record = mongoose.model<IRecord>('Record', recordSchema);

export default Record;
