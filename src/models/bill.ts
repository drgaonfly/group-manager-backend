import mongoose, { Document } from 'mongoose';

// TypeScript interface for Bill
export interface IBill extends Document {
  storeName: string;  // 店铺名字
  orderNumber: string;  // 订单号
  amount: number;  // 金额
  buyerId: string;  // 买手号
  task?: mongoose.Schema.Types.ObjectId;  // 关联的任务ID
  createdAt?: Date; // Time of document creation
  updatedAt?: Date; // Time the document was last updated
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
    required: true,
    ref: 'Task'  // Assuming a Task model exists
  }
}, { timestamps: true });

// Mongoose model for Bill
const Bill = mongoose.model<IBill>('Bill', billSchema);

export default Bill;
