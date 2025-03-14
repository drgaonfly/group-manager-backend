import mongoose, { Document } from 'mongoose';

export interface IReleaseRecord extends Document {
  customer: mongoose.Schema.Types.ObjectId; // 客户ID
  activity: mongoose.Schema.Types.ObjectId; // 活动ID
  chainName: string; // 链名称
  walletAddress: string; // 钱包地址
  // agentUser: mongoose.Schema.Types.ObjectId; // 代理用户
  applyTime: Date; // 申请时间
  status: 'pending' | 'success' | 'refused'; // 操作状态
  stakedUsdt: number; // 质押USDT数量
  rewardEth: number; // 奖励ETH数量
  lockDays: number; // 锁定天数
  releaseTime: Date; // 解押时间
  createdAt?: Date;
  updatedAt?: Date;
}

const releaseRecordSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      comment: '客户ID',
    },
    activity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Activity',
      required: true,
      comment: '活动ID',
    },
    chainName: { type: String, required: true, comment: '链名称' },
    walletAddress: { type: String, required: true, comment: '钱包地址' },
    applyTime: { type: Date, required: true, comment: '申请时间' },
    status: {
      type: String,
      enum: ['pending', 'success', 'refused'],
      required: true,
      comment: '操作状态',
    },
    stakedUsdt: { type: Number, required: true, comment: '质押USDT数量' },
    rewardEth: { type: Number, required: true, comment: '奖励ETH数量' },
    lockDays: { type: Number, required: true, comment: '锁定天数' },
    releaseTime: { type: Date, required: true, comment: '解押时间' },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      comment: '代理用户',
    },
  },
  {
    timestamps: true,
  },
);

const ReleaseRecord = mongoose.model<IReleaseRecord>(
  'releaseRecord',
  releaseRecordSchema,
);

export default ReleaseRecord;
