import mongoose, { Document, Schema } from 'mongoose';

export interface IWallet extends Document {
  botUser: Schema.Types.ObjectId; // 关联的 BotUser
  bot: Schema.Types.ObjectId; // 关联的 Bot
  name?: string;
  address: string;
  balance: number;
  isOnline: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    botUser: { type: Schema.Types.ObjectId, ref: 'BotUser', required: true }, // 必须关联 BotUser
    bot: { type: Schema.Types.ObjectId, ref: 'Bot', required: true }, // 必须关联 Bot
    name: { type: String, trim: true },
    address: { type: String, required: true, trim: true, unique: true },
    balance: { type: Number, default: 0 },
    isOnline: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);

export default Wallet;
