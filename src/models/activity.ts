import mongoose, { Document } from 'mongoose';

export interface IActivity extends Document {
  id: string;
  customer: mongoose.Schema.Types.ObjectId;
  usdtAmount: number;
  ethProfit: number;
  lockDuration: number;
  activityEndTime: Date;
  participateTime: Date;
  status: 'pending' | 'active' | 'completed';
  createdAt?: Date;
  updatedAt?: Date;
  user: mongoose.Schema.Types.ObjectId;
}

const activitySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // 活动唯一标识ID
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    }, // 关联的用户ID
    usdtAmount: { type: Number, required: true }, // USDT参与金额
    ethProfit: { type: Number, required: true }, // ETH收益金额
    lockDuration: { type: Number, required: true }, // 锁定天数
    activityEndTime: { type: Date, required: true }, // 活动结束时间
    participateTime: { type: Date, required: false }, // 参与时间
    status: {
      type: String,
      enum: ['pending', 'active', 'completed'],
      default: 'pending',
    }, // 活动状态
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    }, // 活动创建者
  },
  { timestamps: true },
);

const Activity = mongoose.model<IActivity>('Activity', activitySchema);

export default Activity;
