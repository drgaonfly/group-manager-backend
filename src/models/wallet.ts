import mongoose, { Document, Schema } from 'mongoose';
import { IBot } from './bot';

export interface IWallet extends Document {
  address: string;
  currency: 'USDT';
  balance: number;
  name?: string;
  isOnline: boolean;
  createdAt: Date;
  updatedAt: Date;
  bot?: Schema.Types.ObjectId | IBot; // 关联的机器人ID
  network: 'ERC20' | 'TRC20' | 'BEP20'; // 区块链网络
}

const walletSchema = new Schema<IWallet>(
  {
    address: { type: String, required: true, unique: true },
    network: {
      type: String,
      enum: ['ERC20', 'TRC20', 'BEP20'], // 明确区块链网络
      required: true,
    },
    currency: {
      type: String,
      enum: ['USDT'], // 可扩展其他稳定币
      default: 'USDT',
    },
    balance: { type: Number, default: 0 },
    name: String,
    isOnline: { type: Boolean, default: true },
    bot: { type: Schema.Types.ObjectId, ref: 'Bot' }, // 关联到Bot集合
  },
  { timestamps: true },
);
const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);

export default Wallet;
