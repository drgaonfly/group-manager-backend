import mongoose, { Document, Schema } from 'mongoose';
import { IBot } from './bot';
import { IBotUser } from './botUser';

export interface IWallet extends Document {
  botUser: mongoose.Schema.Types.ObjectId | IBotUser; // 关联的 BotUser
  bot: mongoose.Schema.Types.ObjectId | IBot; // 关联的 Bot
  name?: string;
  address: string;
  usdt_balance: number;
  trx_balance: number;
  isOnline: boolean;
  remark: string;
  createdAt: Date;
  updatedAt: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    botUser: { type: Schema.Types.ObjectId, ref: 'BotUser', required: true }, // 必须关联 BotUser
    bot: { type: Schema.Types.ObjectId, ref: 'Bot', required: true }, // 必须关联 Bot
    name: { type: String, trim: true },
    address: { type: String, required: true, trim: true, unique: true },
    usdt_balance: { type: Number, default: 0 },
    trx_balance: { type: Number, default: 0 },
    isOnline: { type: Boolean, default: true },
    remark: { type: String, trim: true },
  },
  { timestamps: true },
);

walletSchema.virtual('receipts', {
  ref: 'Receipt',
  localField: '_id',
  foreignField: 'wallet',
});

const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);

export default Wallet;
