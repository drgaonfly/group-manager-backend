import mongoose, { Document } from 'mongoose';
// import { IAnswer } from './answer';

export interface ITopic extends Document {
  video1: string;
  video2: string;
  answer: mongoose.Types.ObjectId;
  number: number;
}

const topicSchema = new mongoose.Schema(
  {
    video1: { type: String, trim: true },
    video2: { type: String, trim: true },
    number: { type: Number, required: true },
    answer: { type: mongoose.Schema.Types.ObjectId, ref: 'Answer' },
  },
  { timestamps: true },
);

const Topic = mongoose.model<ITopic>('Topic', topicSchema);

export default Topic;
