import mongoose, { Document } from 'mongoose';
import { IUser } from './user';

export interface IActivity extends Document {
  user: mongoose.Schema.Types.ObjectId | IUser;
  type: 'stacking' | 'rewards';
  status: 'pending' | 'joined' | 'finished' | 'expired';
  usdtBalance: number;
  ethEarnings: number;
  lockDays: number;
  startAt: Date;
  endAt: Date;
  joinAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['stacking', 'joined', 'finished', 'expired'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'rewards'],
      required: true,
    },
    usdtBalance: { type: Number, required: true },
    ethEarnings: { type: Number, required: true },
    lockDays: { type: Number, required: false },
    startAt: { type: Date, required: false },
    endAt: { type: Date, required: false },
    joinAt: { type: Date, required: false },
  },
  { timestamps: true },
);

const Activity = mongoose.model<IActivity>('Activity', activitySchema);

export default Activity;
