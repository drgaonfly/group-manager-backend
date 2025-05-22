import mongoose, { Document, Schema } from 'mongoose';
import { IBotUser } from './botUser';
import { IBot } from './bot';
import { ISubscription } from './subscription';
import { IWallet } from './wallet';

export interface IPayment extends Document {
  // wallet: Schema.Types.ObjectId | IWallet;
  id: string;
  orderNumber: string;
  // wallet: Schema.Types.ObjectId | IWallet;
  amount: number;
  status: 'pending' | 'paid' | 'expired';
  type: 'recharge' | 'subscription';
  txHash?: string;
  createdAt: Date;
  expiresAt: Date;
  sendAddress: string;
  receiveAddress?: string;
  // currency: 'USDT_ERC20' | 'USDT_TRC20';
  botUser: Schema.Types.ObjectId | IBotUser;
  bot: Schema.Types.ObjectId | IBot;
  subscription: Schema.Types.ObjectId | ISubscription; // 关联的订阅记录
  subscriptionInfo?: {
    price: number;
    type: string;
    days: number;
    label: string;
  };
}

const subscriptionInfoSchema = new Schema(
  {
    price: { type: Number, required: true },
    type: { type: String, required: true },
    days: { type: Number, required: true },
    label: { type: String, required: true },
  },
  { _id: false },
);

const paymentSchema = new Schema<IPayment>(
  {
    id: { type: String, required: true, unique: true },
    orderNumber: { type: String, required: true, unique: true },
    // wallet: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'paid', 'expired', 'cancelled'],
      default: 'pending',
    },
    txHash: String,
    expiresAt: { type: Date, required: true },
    sendAddress: { type: String, required: false },
    subscription: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      required: false,
    }, // 关联的订阅记录
    type: {
      type: String,
      enum: ['recharge', 'subscription'],
      required: true,
    }, // 支付类型：充值或订阅
    // currency: {
    //   type: String,
    //   enum: ['USDT_ERC20', 'USDT_TRC20'],
    //   default: 'USDT_TRC20',
    // },
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
    receiveAddress: { type: String, required: true },
    subscriptionInfo: {
      type: subscriptionInfoSchema,
      required: false,
    }, // 订阅信息详情
  },
  { timestamps: true },
);

const Payment = mongoose.model<IPayment>('Payment', paymentSchema);

export default Payment;
