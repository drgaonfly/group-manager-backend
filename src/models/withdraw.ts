import mongoose, { Document } from 'mongoose';

export interface IWithdraw extends Document {
  user: mongoose.Types.ObjectId; // 关联用户
  withdrawalNumber: number;
  Time: Date;
  withdrawalMethod: string;
  reviewStatus: string;
  paymentStatus: string;
  amount: number;
}

const withdrawSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    withdrawalNumber: { type: Number },
    Time: { type: Date }, // 申请时间
    withdrawalMethod: {
      type: String,
      required: true,
      enum: ['WeChat', 'Alipay', 'Cash', 'Other'],
      default: 'WeChat',
    }, // 提现方式
    reviewStatus: {
      type: String,
      required: true,
      enum: ['reviewed', 'unreviewed'],
      default: 'unreviewed',
    }, // 审核状态
    paymentStatus: {
      type: String,
      required: true,
      enum: ['paid', 'unpaid'],
      default: 'unpaid',
    }, // 打款状态
    amount: { type: Number }, // 提现金额(元)
  },
  { timestamps: true },
);

const Withdraw = mongoose.model<IWithdraw>('Withdraw', withdrawSchema);

export default Withdraw;
