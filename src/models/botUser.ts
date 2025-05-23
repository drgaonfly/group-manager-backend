import mongoose, { Document } from 'mongoose';
import { IBotUserMessage } from './botUserMessage';
import { ITransaction } from './transaction';
export interface IBotUser extends Document {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  messages: mongoose.Types.ObjectId[] | IBotUserMessage[];
  createdAt: Date;
  updatedAt: Date;
  transactions: ITransaction[]; // 虚拟字段，指向 Transaction 模型的 _id 数组
  isAuthorized: boolean; // 用户是否已授权
}

const botUserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    userName: { type: String, required: false },
    firstName: { type: String, required: false },
    lastName: { type: String, required: false },
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BotUserMessage' }],
    isAuthorized: { type: Boolean, default: false }, // 默认未授权
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

botUserSchema.index({ id: 1, bot: 1 }, { unique: true });

botUserSchema.virtual('transactions', {
  ref: 'Transaction',
  localField: '_id',
  foreignField: 'botUser',
});

botUserSchema.virtual('payments', {
  ref: 'Payment',
  localField: '_id',
  foreignField: 'botUser',
});

const BotUser = mongoose.model<IBotUser>('BotUser', botUserSchema);

export default BotUser;
