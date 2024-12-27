import mongoose, { Document } from 'mongoose';

export interface IAnswer extends Document {
  name: string;
  image: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const answerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    image: { type: String, required: true },
  },
  { timestamps: true },
);

const Answer = mongoose.model<IAnswer>('Answer', answerSchema);

export default Answer;
