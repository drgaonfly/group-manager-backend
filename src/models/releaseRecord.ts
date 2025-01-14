import mongoose, { Document } from 'mongoose';
import { IWallet } from './wallet';
import { IActivity } from './activity';

export interface IReleaseRecord extends Document {
  // user: mongoose.Schema.Types.ObjectId | IUser;
  wallet: mongoose.Schema.Types.ObjectId | IWallet;
  activity: mongoose.Schema.Types.ObjectId | IActivity;
  stackedUsdtBalance: number;
  rewardingEthBalance: number;
  status: 'pending' | 'success' | 'refused';
  applyingAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const releaseRecordSchema = new mongoose.Schema(
  {
    // user: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: 'User',
    //   required: true,
    // },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
    },
    activity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Activity',
      required: true,
    },
    stackedUsdtBalance: {
      type: Number,
      default: 0,
      required: false,
    },
    rewardingEthBalance: {
      type: Number,
      default: 0,
      required: false,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'refused'],
      required: true,
    },
    applyingAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

const ReleaseRecord = mongoose.model<IReleaseRecord>(
  'releaseRecord',
  releaseRecordSchema,
);

export default ReleaseRecord;
