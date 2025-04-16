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
  reason: string;
  employee: mongoose.Schema.Types.ObjectId | IUser;
  isFrozen: boolean;
  frozen: boolean;
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
    amount: { type: Number, require: true }, //提现金额
    fee: { type: Number, required: true }, // 手续费
    isFrozen: {
      type: Boolean,
      default: false,
    }, //冻结状态

    // 来代替上面的冻结
    frozen: {
      type: Boolean,
      default: true,
    },

    finalAmount: { type: Number }, //扣去手续费金额
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
    reason: {
      type: String,
      default: '',
    }, // 理由
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    }, // 员工
    //直接存代理id, 存员工id,
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    }, // 代理
  },
  { timestamps: true },
);

const Withdraw = mongoose.model<IWithdraw>('Withdraw', withdrawSchema);

export default Withdraw;
