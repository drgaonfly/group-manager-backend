import mongoose, { Document } from 'mongoose';
import { IAnswer } from './answer';

export interface ITopic extends Document {
  video1: string;
  video2?: string;
  topicNumber: number;
  id: string;
  correctAnswers: Array<{
    answer: mongoose.Types.ObjectId | IAnswer;
    count: number;
  }>;
  answers: Array<IAnswer>;
}

const topicSchema = new mongoose.Schema(
  {
    video1: { type: String, trim: true, required: true },
    video2: { type: String, trim: true, required: false },
    topicNumber: { type: Number, required: true, unique: true },
    id: { type: String, required: false },
    correctAnswers: [
      {
        answer: { type: mongoose.Schema.Types.ObjectId, ref: 'Answer' },
        count: { type: Number, default: 1 },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

topicSchema.virtual('answers', {
  ref: 'Answer',
  localField: '_id',
  foreignField: 'topic',
  justOne: false,
});

const Topic = mongoose.model<ITopic>('Topic', topicSchema);

export default Topic;
