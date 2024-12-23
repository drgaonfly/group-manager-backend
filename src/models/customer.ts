import mongoose, { Document } from 'mongoose';
import { IUser } from './user';

export interface ICustomer extends Document {
  phoneNumber: string;
  password: string;
  phoneCode: string;
  remark?: string;
  createdAt: Date;
  updatedAt: Date;
  localStorage?: string;
  session: string;
  ip: string | string[];
  user: mongoose.Schema.Types.ObjectId | IUser;
  isOnline: boolean;
  bot: mongoose.Schema.Types.ObjectId;
}

const customerSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    password: {
      type: String,
      required: false,
    },
    session: {
      type: String,
      required: false,
    },
    remark: {
      type: String,
      trim: true,
    },
    ip: {
      type: String, // 字符串，存储 IP 地址
      trim: true,
    },
    phoneCode: {
      type: String,
      required: false,
      trim: true,
    },
    localStorage: {
      type: String,
      default: '',
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
    },
  },
  {
    timestamps: true,
  },
);

const Customer = mongoose.model<ICustomer>('Customer', customerSchema);

export default Customer;
