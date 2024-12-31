import mongoose, { Document } from 'mongoose';
import { ITopic } from './topic';

export interface IAnswer extends Document {
  name: string;
  image: string;
  createdAt?: Date;
  updatedAt?: Date;
  topic: mongoose.Types.ObjectId | ITopic;
  skuName: string;
  sn: string;
  spec: string;
  id: string;
  rowNumber: number;
}

const answerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    image: { type: String, required: true },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
    id: { type: String, required: false },
    skuName: { type: String, required: false },
    sn: { type: String, required: false },
    spec: { type: String, required: false },
    rowNumber: { type: Number, required: false },
  },
  { timestamps: true },
);

const Answer = mongoose.model<IAnswer>('Answer', answerSchema);

export default Answer;
