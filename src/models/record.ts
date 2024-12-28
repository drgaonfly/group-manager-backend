import mongoose, { Document } from 'mongoose';

export interface IRecord extends Document {
  user: mongoose.Types.ObjectId; // 关联用户
  topic: mongoose.Types.ObjectId; // 关联到 Topic
  answer: mongoose.Types.ObjectId; // 关联到 Answer
  issue: string[];
  status: string;
  answerCount: number;
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
    answer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Answer',
      required: true,
    },
    issue: {
      type: [String],
      required: true,
    },
    status: {
      type: String,
      enum: ['正在', '答对', '答错'],
      required: true,
    },
    answerCount: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true },
);

const Record = mongoose.model<IRecord>('Record', recordSchema);

export default Record;
