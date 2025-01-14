import mongoose, { Document } from 'mongoose';
import { IUser } from './user';

export interface ITag extends Document {
  customer: mongoose.Schema.Types.ObjectId | IUser;
  proxy: mongoose.Schema.Types.ObjectId | IUser;
  chainName: string;
  fromAddress: string;
  toAddress: string;
  currency: string;
  amount: number;
  transferType: string;
  remark: string;
  createdAt: Date;
  updatedAt: Date;
}

const tagSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    chainName: { type: String, required: true },
    fromAddress: { type: String, required: true },
    toAddress: { type: String, required: true },
    currency: { type: String, required: true },
    amount: { type: Number, required: true },
    transferType: { type: String, required: true },
    remark: { type: String, required: false },
  },
  { timestamps: true },
);

const Tag = mongoose.model<ITag>('Tag', tagSchema);

export default Tag;
