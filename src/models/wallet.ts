import mongoose, { Document } from 'mongoose';
import { IUser } from './user';

export interface IWallet extends Document {
  id: string;
  user: mongoose.Schema.Types.ObjectId | IUser;
  network: 'TRX' | 'BSC' | 'ETH';
  address: string;
  secretKey: string;
  balance: number;
}

const walletSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // 代理用户
    network: { type: String, enum: ['TRX', 'BSC', 'ETH'], required: true }, // 区块链网络类型
    address: { type: String, required: true }, // 钱包地址
    secretKey: { type: String, required: false, select: false }, // 钱包私钥
    balance: { type: Number, required: false }, // 钱包余额
  },
  {
    timestamps: true,
  },
);

// 为user、network和address字段创建复合唯一索引
walletSchema.index({ user: 1, network: 1, address: 1 }, { unique: true });

const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);

export default Wallet;
