import mongoose, { Document } from 'mongoose';
import { IBill } from './bill';
import { IUser } from './user';

// TypeScript interface for AfterSalesOrder
export interface IAfterSalesOrder extends Document {
  reason: string;  // 售后原因
  refundAmount: number;  // 退款金额
  image: string;  // 图片
  bill: mongoose.Schema.Types.ObjectId | IBill;  // 所属的账单
  user: mongoose.Schema.Types.ObjectId | IUser;  // New field for the user
  createdAt?: Date; // Time of document creation
  updatedAt?: Date; // Time the document was last updated
  status: 'Pending' | 'Processing' | 'Approved';  // New field for the status
}

// Mongoose schema definition for AfterSalesOrder
const afterSalesOrderSchema = new mongoose.Schema<IAfterSalesOrder>({
  reason: {
    type: String,
    required: true,
    trim: true
  },
  refundAmount: {
    type: Number,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  bill: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Bill'  // Assuming a Bill model exists
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'  // Assuming a User model exists
  },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Approved'],
    default: 'Pending'
  },
}, { timestamps: true });

// Mongoose model for AfterSalesOrder
const AfterSalesOrder = mongoose.model<IAfterSalesOrder>('AfterSalesOrder', afterSalesOrderSchema);

export default AfterSalesOrder;