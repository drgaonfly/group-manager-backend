import mongoose, { Document, Schema } from 'mongoose';
import { IBotUser } from './botUser';
import { IWallet } from './wallet';
import { IBot } from './bot';

export interface IPayment extends Document {
  wallet: Schema.Types.ObjectId | IWallet;
  amount: number;
  status: 'pending' | 'paid' | 'expired';
  txHash?: string;
  createdAt: Date;
  expiresAt: Date;
  sendAddress: string;
  receiveAddress?: string;
  currency: 'USDT_ERC20' | 'USDT_TRC20';
  botUser: Schema.Types.ObjectId | IBotUser;
  bot: Schema.Types.ObjectId | IBot;
}

const paymentSchema = new Schema<IPayment>(
  {
    wallet: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'paid', 'expired'],
      default: 'pending',
    },
    txHash: String,
    expiresAt: { type: Date, required: true },
    sendAddress: { type: String, required: false },
    currency: {
      type: String,
      enum: ['USDT_ERC20', 'USDT_TRC20'],
      default: 'USDT_TRC20',
    },
    botUser: {
      type: Schema.Types.ObjectId,
      ref: 'BotUser',
      required: true,
    }, // 订单发起者
    bot: {
      type: Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
    }, // 订单所属的bot
    receiveAddress: { type: String, required: false },
  },
  { timestamps: true },
);

const Payment = mongoose.model<IPayment>('Payment', paymentSchema);

export default Payment;
