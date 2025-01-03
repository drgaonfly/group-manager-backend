import mongoose, { Document } from 'mongoose';
import { IAnswer } from './answer';

export interface ITopic extends Document {
  video1: string;
  video2?: string;
  id: number;
  correctAnswers: ICorrectAnswer[];
  answers: Array<IAnswer>;
}

export interface ICorrectAnswer {
  count: number;
  answer: mongoose.Types.ObjectId;
}

const correctAnswerSchema = new mongoose.Schema({
  count: { type: Number, require: true, default: 1 },
  answer: {
    type: mongoose.Schema.Types.ObjectId,
    require: true,
    ref: 'Answer',
  },
});

const topicSchema = new mongoose.Schema(
  {
    video1: { type: String, trim: true, required: true },
    video2: { type: String, trim: true, required: false },
    id: { type: Number, required: true, unique: true },
    correctAnswers: [correctAnswerSchema],
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
