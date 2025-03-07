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

const walletShare = new mongoose.Schema(
  {
    id: { type: String }, // 客户ID
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // 代理用户
    network: { type: String, enum: ['TRX', 'BSC', 'ETH'], required: true }, // 区块链网络类型
    address: { type: String, required: true }, // 钱包地址
  },
  {
    timestamps: true,
  },
);

const WalletShare = mongoose.model<Document>('WalletShare', walletShare);

export default WalletShare;
