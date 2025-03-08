import mongoose, { Document } from 'mongoose';
import { IWallet } from './wallet';

export interface IUser extends Document {
  id: string;
  wallets: mongoose.Schema.Types.ObjectId | IWallet;
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
  isOnline: boolean;
  creator: mongoose.Schema.Types.ObjectId | IUser;
}

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      required: false,
    },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: false },
    live: { type: Boolean, default: true },
    status: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
    inviteCode: { type: String },
    memberNum: { type: Number, default: 0 },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    commissionRate: { type: Number, default: 0 },
    stackingChannel: { type: String, enum: ['platform', 'broker'] },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

const User = mongoose.model<IUser>('User', userSchema);

export default User;
