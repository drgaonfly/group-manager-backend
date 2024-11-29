import mongoose, { Schema, Document } from 'mongoose';

export interface IVipMember extends Document {
  customer: Schema.Types.ObjectId; // 关联到 customer
  level: number; // VIP 等级 1-5
  startDate: Date; // 开始时间
  endDate: Date; // 结束时间
  isActive: boolean; // 使用布尔值替代 status
  amount: number; // 支付金额
  createdAt: Date; // 创建时间
  updatedAt: Date; // 更新时间
}

const vipMemberSchema = new Schema(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    level: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      max: 5,
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model<IVipMember>('VipMember', vipMemberSchema);
