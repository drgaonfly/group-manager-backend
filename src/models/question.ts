import mongoose, { Document } from 'mongoose';

export interface IQuestion extends Document {
  lang: 'en' | 'zh';
  type: 'exchange' | 'serve';
  content: string;
  title: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const questionSchema = new mongoose.Schema(
  {
    lang: {
      type: String,
      enum: ['en', 'zh'],
      required: false,
    },
    type: {
      type: String,
      enum: ['exchange', 'serve'],
      required: true,
    },
    title: { type: String, required: false },
    content: { type: String, required: false },
  },
  { timestamps: true },
);

const Question = mongoose.model<IQuestion>('Question', questionSchema);

export default Question;
