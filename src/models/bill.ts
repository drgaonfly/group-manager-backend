import mongoose, { Document } from 'mongoose';

export interface IBill extends Document {
  amount: number;
  rate: number; // 费率
  fixedRate: number; // 固定汇率
  transactionType: string; // 交易类型
  createdAt?: Date;
  updatedAt?: Date;
  isOnline: boolean; // 是否在线
}

const billSchema = new mongoose.Schema(
  {
    isOnline: { type: Boolean, required: true, default: false },
    amount: { type: Number, required: true },
    rate: { type: Number, required: true }, // 费率
    fixedRate: { type: Number, required: true }, // 固定汇率
    transactionType: {
      type: String,
      enum: ['income', 'issue'],
      required: true,
    },
  },
  { timestamps: true },
);

const Bill = mongoose.model<IBill>('Bill', billSchema);

export default Bill;
