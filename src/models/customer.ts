import mongoose, { Document } from 'mongoose';

export interface ICustomer extends Document {
  phoneNumber: string;
  password: string;
  phoneCode: string;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
  localStorage?: string;
  session: string;
  ip: string | string[];
  users: mongoose.Schema.Types.ObjectId;
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
    remarks: {
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
