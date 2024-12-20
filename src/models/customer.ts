import mongoose, { Document } from 'mongoose';

export interface ICustomer extends Document {
  phoneNumber: string;
  password: string;
  phoneCode: string;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
  localStorage?: string;
  ip: string | string[];
  users: mongoose.Schema.Types.ObjectId;
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
      required: true,
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
    users: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
);

const Customer = mongoose.model<ICustomer>('Customer', customerSchema);

export default Customer;
