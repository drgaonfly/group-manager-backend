import mongoose, { Document } from 'mongoose';
import { ICustomer } from './customer';
import { IUser } from './user';

export interface IWithdraw extends Document {
  id: string;
  customer: mongoose.Schema.Types.ObjectId | ICustomer;
  amount: number;
  fee: number;
  status: string;
  remark: string;
  employee: mongoose.Schema.Types.ObjectId | IUser;
}

const withdrawSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    amount: { type: Number },
    fee: { type: Number, required: true }, // 手续费
    status: {
      type: String,
      required: true,
      enum: ['pending', 'completed', 'rejected'],
      default: 'pending',
    }, // 审核状态
    remark: {
      type: String,
      default: '',
    }, // 备注
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    }, // 员工
  },
  { timestamps: true },
);

const Withdraw = mongoose.model<IWithdraw>('Withdraw', withdrawSchema);

export default Withdraw;
