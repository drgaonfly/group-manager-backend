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
  proxys?: string;
}

const customerSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    // username: {
    //   type: String,
    //   required: true,
    //   unique: true,
    //   trim: true,
    // },
    // email: {
    //   type: String,
    //   required: true,
    //   unique: true,
    //   trim: true,
    //   lowercase: true,
    // },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    phoneCode: {
      type: String,
      required: true,
      trim: true,
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
    proxys: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Proxy', // 修正引用名称为 'Proxy'
    },
  },
  {
    timestamps: true,
  },
);

const Customer = mongoose.model<ICustomer>('Customer', customerSchema);

export default Customer;
