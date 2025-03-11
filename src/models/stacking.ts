import mongoose, { Document } from 'mongoose';

export interface IStacking extends Document {
  fromAddress: string;
  fromNetwork: string;
  toAddress: string;
  toNetwork: string;
  amount: number;
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
  },
  {
    timestamps: true,
  },
);

const Stacking = mongoose.model<IStacking>('Stacking', stackingSchema);

export default Stacking;
