import mongoose, { Document } from 'mongoose';
import { IUser } from './user';
import { ICustomer } from './customer';
export interface IStacking extends Document {
  fromAddress: string;
  fromNetwork: string;
  toAddress: string;
  toNetwork: string;
  amount: number;
  isFrozen: boolean;
  employee: mongoose.Schema.Types.ObjectId | IUser;
  customer: mongoose.Schema.Types.ObjectId | ICustomer;
  createdAt?: Date;
  updatedAt?: Date;
}

const stackingSchema = new mongoose.Schema(
  {
    fromAddress: { type: String, required: true }, // 转出地址
    fromNetwork: { type: String, required: true }, // 转出网络
    toAddress: { type: String, required: true }, // 转入地址
    toNetwork: { type: String, required: true }, // 转入网络
    amount: { type: Number, required: true }, // 质押USDT数量
    isFrozen: { type: Boolean, default: false }, // 是否冻结质押金额 false 是未冻结 true 是冻结
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    }, // 员工
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    //直接关联代理
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    }, // 代理
  },
  {
    timestamps: true,
  },
);

const Stacking = mongoose.model<IStacking>('Stacking', stackingSchema);

export default Stacking;
