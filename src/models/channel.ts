import mongoose, { Document } from 'mongoose';
import { IUser } from './user';

export interface IChannel extends Document {
  code: string;
  agent: mongoose.Schema.Types.ObjectId | IUser;
  invitingAddress: string;
  status: boolean;
  createAt?: Date;
  updatedAt?: Date;
}

const channelSchema = new mongoose.Schema(
  {
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    code: { type: String, required: true },
    invitingAddress: { type: String },
    status: { type: Boolean, required: true },
  },
  { timestamps: true },
);

const Channel = mongoose.model<IChannel>('Channel', channelSchema);

export default Channel;
