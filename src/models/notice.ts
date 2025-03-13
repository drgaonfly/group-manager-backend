import mongoose, { Document } from 'mongoose';

export interface INotice extends Document {
  id: string;
  title: string;
  type: 'notice' | 'propaganda';
  content: string;
  creator: string;
  readAt?: Date;
}

const noticeSchema = new mongoose.Schema(
  {
    id: { type: String, required: false },
    title: { type: String, required: false },
    type: {
      type: String,
      enum: ['notice', 'propaganda'],
      required: true,
    },
    content: { type: String, required: false },
    creator: { type: String, required: false },
    readAt: { type: Date, required: false },
  },
  { timestamps: true },
);

const Notice = mongoose.model<INotice>('Notice', noticeSchema);

export default Notice;
