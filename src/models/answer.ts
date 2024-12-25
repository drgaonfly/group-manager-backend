import mongoose, { Document } from 'mongoose';

export interface IAnswer extends Document {
  Name: string;
  packageImageUrl: string;

  createdAt?: Date;
  updatedAt?: Date;
}

const answerSchema = new mongoose.Schema(
  {
    Name: { type: String, required: true },
    packageImageUrl: { type: String, required: true },
  },
  { timestamps: true },
);

const Answer = mongoose.model<IAnswer>('Answer', answerSchema);

export default Answer;
