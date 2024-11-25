import mongoose, { Document } from 'mongoose';

export interface ICustomer extends Document {
  _id: string;
  username: string;
  email: string;
  phone?: string;
  address?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  },
);

// 添加索引以提高查询性能
customerSchema.index({ email: 1 });
customerSchema.index({ username: 1 });

const Customer = mongoose.model<ICustomer>('Customer', customerSchema);

export default Customer;
