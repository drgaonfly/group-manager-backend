import mongoose, { Document } from 'mongoose';
import { IUser } from './user';

export interface IWallet extends Document {
  id: string;
  user: mongoose.Schema.Types.ObjectId | IUser;
  network: 'TRX' | 'BSC' | 'ETH';
  address: string;
  balance: number;
}

const walletShare = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // 代理用户
    network: { type: String, enum: ['TRX', 'BSC', 'ETH'], required: true }, // 区块链网络类型
    address: { type: String, required: true }, // 钱包地址
    //直接存代理id, 存员工id,
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    }, // 代理
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: false,
    }, // 代理
  },
  {
    timestamps: true,
  },
);

const WalletShare = mongoose.model<IWallet>('WalletShare', walletShare);

export default WalletShare;
