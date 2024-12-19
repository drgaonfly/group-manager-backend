import mongoose, { Document } from 'mongoose';

export interface ICustomer extends Document {
  _id: string;
  // username: string;
  // email: string;
  phoneNumber: string;
  password: string;
  phoneCode: string;
  session?: string;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
  users?: string;
  localStorage?: string;
}

const customerSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    session: {
      type: String,
      trim: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
    cookies: {
      type: [String], // 数组，存储多个 cookie
      default: [], // 默认为空数组
    },
    ip: {
      type: String, // 字符串，存储 IP 地址
      trim: true,
    },
    certification: {
      type: String,
      required: false,
    },
    users: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // 修正引用名称为 'Proxy'
    },
    localStorage: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

const Customer = mongoose.model<ICustomer>('Customer', customerSchema);

export default Customer;
