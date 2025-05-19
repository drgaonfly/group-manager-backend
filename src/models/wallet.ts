import mongoose, { Document, Schema } from 'mongoose';
import { IBot } from './bot';

export interface IWallet extends Document {
  address: string;
  currency: 'USDT_ERC20' | 'USDT_TRC20';
  balance: number;
  name?: string;
  isOnline: boolean;
  createdAt: Date;
  updatedAt: Date;
  bot?: Schema.Types.ObjectId | IBot; // 关联的机器人ID
}

const walletSchema = new Schema<IWallet>(
  {
    address: { type: String, required: true, unique: true },
    currency: {
      type: String,
      enum: ['USDT_ERC20', 'USDT_TRC20'],
      default: 'USDT_TRC20',
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
