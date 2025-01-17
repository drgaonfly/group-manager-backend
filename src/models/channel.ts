import mongoose, { Document } from 'mongoose';
import { IUser } from './user';

export interface IChannel extends Document {
  code: string;
  user: mongoose.Schema.Types.ObjectId | IUser;
  invitingAddress: string;
  status: boolean;
  customerNum: string;
  createAt?: Date;
  updatedAt?: Date;
}

const channelSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    code: { type: String, required: true },
    invitingAddress: { type: String, required: false },
    status: { type: Boolean, required: false, default: true },
    customerNum: { type: String, required: false },
  },
  { timestamps: true },
);

const Channel = mongoose.model<IChannel>('Channel', channelSchema);

export default Channel;
