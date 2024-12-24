import mongoose, { Document } from 'mongoose';
import { IAnswer } from './answer';

export interface ITopic extends Document {
  video1: string;
  video2: string;
  issue: string;
  answers: IAnswer;
}

const topicSchema = new mongoose.Schema(
  {
    video1: { type: String, required: true },
    video2: { type: String, required: true },
    issue: {
      type: String,
      required: true,
      enum: ['normal', 'unfriendly', 'recogError', 'videoError'],
    },
    answers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Answer' }],
  },
  { timestamps: true },
);

const Topic = mongoose.model<ITopic>('Topic', topicSchema);

export default Topic;
