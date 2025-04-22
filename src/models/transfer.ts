import mongoose, { Document } from 'mongoose';
import { IUser } from './user';

export interface ITransfer extends Document {
  network: string; // 网络类型
  sender: string; // 发送者
  adminWallet: string; // 管理员钱包地址
  adminAmount: number; // 管理员金额
  adminHash: string; // 管理员交易哈希
  proxyWallet?: string; // 代理钱包地址（可选）
  proxyAmount?: number; // 代理金额（可选）
  proxyHash?: string; // 代理交易哈希（可选）
  type: 'direct' | 'agent'; // 转账类型：直接或代理
  status: 'success' | 'failed' | 'pending'; // 转账状态
  employee: mongoose.Schema.Types.ObjectId | IUser;
  proxy: mongoose.Schema.Types.ObjectId | IUser;
  customer: mongoose.Schema.Types.ObjectId;
}

const transferSchema = new mongoose.Schema(
  {
    network: { type: String, required: true }, // 网络类型，必填
    sender: { type: String, required: true }, // 发送者钱包地址
    adminWallet: { type: String, required: true }, // 管理员钱包地址，必填
    adminAmount: { type: Number, required: true }, // 管理员金额，必填
    adminHash: { type: String, required: true }, // 管理员交易哈希，必填
    proxyWallet: { type: String, required: false }, // 代理钱包地址，选填
    proxyAmount: { type: Number, required: false }, // 代理金额，选填
    proxyHash: { type: String, required: false }, // 代理交易哈希，选填
    type: {
      type: String,
      enum: ['direct', 'agent'], // 转账类型，枚举值：direct 或 agent
      required: true, // 必填
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    }, // 员工
    status: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      required: true,
    }, // 转账状态，必填
    //直接存代理id, 存员工id,
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    }, // 代理
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    }, // 代理
  },
  { timestamps: true }, // 自动添加创建和更新的时间戳
);

const Transfer = mongoose.model<ITransfer>('Transfer', transferSchema);

export default Transfer;
