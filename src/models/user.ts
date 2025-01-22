import mongoose, { Document } from 'mongoose';
import { IWallet } from './wallet';

export interface IUser extends Document {
  id: string;
  wallets: IWallet[];
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
  lastLoginAt: Date;
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
      required: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

const User = mongoose.model<IUser>('User', userSchema);

export default User;
