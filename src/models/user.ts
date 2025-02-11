import mongoose, { Document } from 'mongoose';
import { IWallet } from './wallet';
import { IChannel } from './channel';

export interface IUser extends Document {
  id: string;
  wallets: mongoose.Schema.Types.ObjectId | IWallet;
  channel: mongoose.Schema.Types.ObjectId | IChannel;
  liquidRate: number;
  stakeRate: number;
  isAdmin: boolean;
  status: boolean;
  roles: any;
  email: string;
  password: string;
  name: string;
  createdAt?: Date; // Time of document creation
  updatedAt?: Date; // Time the document was last updated
  live: boolean;
  inviteCode: string;
  memberNum: number;
  commissionRate: number;
  stackingChannel: 'platform' | 'broker';
  createAt: Date;
  updateAt: Date;
  logedinAt: Date;
  lastLoginAt: Date;
  createdIP: string;
  LogedinIP: string;
  isSpied: boolean;
  isAuthorized: boolean;
  isDemo: boolean;
}

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    wallets: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet', // Reference the Wallet model
        required: false,
      },
    ],
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel', // Reference the Channel model
      required: false,
    },
    liquidRate: {
      type: Number,
      default: 0,
    },
    stakeRate: {
      type: Number,
      default: 0,
    },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: false },
    live: {
      type: Boolean,
      default: true,
    },
    status: {
      type: Boolean,
      default: false,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    roles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role', // Reference the Role model
      },
    ],
    inviteCode: {
      type: String,
    },
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    memberNum: {
      type: Number,
      default: 0,
    },
    commissionRate: {
      type: Number,
      default: 0,
    },
    stackingChannel: {
      type: String,
      enum: ['platform', 'broker'],
    },
    lastLoginAt: {
      type: Date,
    },
    createdAt: {
      type: Date,
    },
    logedinAt: {
      type: Date,
    },
    createdIP: {
      type: String,
    },
    LogedinIP: {
      type: String,
    },
    isSpied: {
      type: Boolean,
      default: false,
    },
    isAuthorized: {
      type: Boolean,
      default: false,
    },
    isDemo: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const User = mongoose.model<IUser>('User', userSchema);

export default User;
