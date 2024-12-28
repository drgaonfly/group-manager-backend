import mongoose, { Document } from 'mongoose';

export interface IAnswer extends Document {
  name: string;
  image: string;
  createdAt?: Date;
  updatedAt?: Date;
  topic: mongoose.Types.ObjectId;
}

const answerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    image: { type: String, required: true },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
  },
  { timestamps: true },
);

const Answer = mongoose.model<IAnswer>('Answer', answerSchema);

export default Answer;
