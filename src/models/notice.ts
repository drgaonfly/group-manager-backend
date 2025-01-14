import mongoose, { Document } from 'mongoose';
import { IUser } from './user';

export interface INotice extends Document {
  customer: mongoose.Schema.Types.ObjectId | IUser;
  noticeTitle: string;
  noticeType: string;
  creator: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const noticeSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    noticeTitle: { type: String, required: true },
    noticeType: {
      type: String,
      enum: ['notice', 'announcement'],
      required: true,
    },
    creator: { type: String, required: false },
  },
  { timestamps: true },
);

const Notice = mongoose.model<INotice>('Notice', noticeSchema);

export default Notice;
