import mongoose, { Document } from 'mongoose';
import { ITask } from './task';
import { IUser } from './user';

// TypeScript interface for Bill
export interface IBill extends Document {
  country: string;  // 国家
  taskSheet: string;  // 任务表
  storeName: string;  // 店铺名字
  date: string;  // 日期
  remark: string;  // 系统编号
  orderNumber: string;  // 订单号
  amount: number;  // 金额
  buyerId: string;  // 买手号
  customerCode: string;  // 客户编码
  task?: mongoose.Schema.Types.ObjectId | ITask;  // 关联的任务ID
  createdAt?: Date; // Time of document creation
  updatedAt?: Date; // Time the document was last updated
  uploadTime?: string; // Time the bill was uploaded
  user: mongoose.Schema.Types.ObjectId | IUser;
  customer: mongoose.Schema.Types.ObjectId | IUser;  // New field for the customer
  exchangeRate: number;
  serviceFee: number;
  paymentAmount: number;
  afterSales: boolean;
  isSigned?: boolean;  // Whether the bill is signed
  isReviewed?: boolean;  // Whether the bill is reviewed
  operations?: { user: mongoose.Schema.Types.ObjectId | IUser, operation: string, operationTime: Date }[];  // New field for operations
  billNote?: string;
}

// Mongoose schema definition for Bill
const billSchema = new mongoose.Schema<IBill>({
  storeName: {
    type: String,
    required: true,
    trim: true
  },
  orderNumber: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true
  },
  buyerId: {
    type: String,
    required: true,
    trim: true
  },
  task: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: 'Task'  // Assuming a Task model exists
  },
  country: {
    type: String,
    required: false
  },
  uploadTime: {
    type: String,
    required: false
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'  // Assuming a User model exists
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'  // Assuming a User model exists
  },
  exchangeRate: { type: Number, required: false },
  serviceFee: { type: Number, required: false },
  paymentAmount: {
    type: Number,
    required: false
  },
  afterSales: {
    type: Boolean,
    default: false,
  },
  isSigned: {
    type: Boolean,
    default: false,
  },
  isReviewed: {
    type: Boolean,
    default: false,
  },
  billNote: {
    type: String,
  },
  operations: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User'  // Assuming a User model exists
    },
    operation: {
      type: String,
      required: true
    },
    operationTime: {
      type: Date,
      default: Date.now
    }
  }],
  taskSheet: {
    type: String,
    required: true,
    trim: false
  },
  date: {
    type: String,
    required: true,
    trim: false
  },
  remark: {
    type: String,
    required: true,
    trim: false
  },
}, { timestamps: true });

// Mongoose model for Bill
const Bill = mongoose.model<IBill>('Bill', billSchema);

export default Bill;
