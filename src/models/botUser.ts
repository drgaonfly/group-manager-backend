import mongoose, { Document } from 'mongoose';
import { IBotUserMessage } from './botUserMessage';
import { ITransaction } from './transaction';
import { ISubscription } from './subscription';
import { IUser } from './user';

export interface IBotUser extends Document {
  id: string;
  proxy: mongoose.Types.ObjectId | IUser;
  userName: string;
  firstName: string;
  lastName: string;
  messages: mongoose.Types.ObjectId[] | IBotUserMessage[];
  transactions: ITransaction[]; // 虚拟字段，指向 Transaction 模型的 _id 数组
  subscriptions: ISubscription[]; // 虚拟字段，指向 Subscription 模型的 _id 数组
  isAuthorized: boolean; // 用户是否已授权
  promotionLink?: mongoose.Types.ObjectId; // 关联的推广链接
  displayName?: string; // 虚拟属性
  createdAt: Date;
  updatedAt: Date;
}

const botUserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    userName: { type: String, required: false },
    firstName: { type: String, required: false },
    lastName: { type: String, required: false },
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BotUserMessage' }],
    isAuthorized: { type: Boolean, default: false }, // 默认未授权
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    promotionLink: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PromotionLink',
      required: false,
    },
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

botUserSchema.virtual('subscriptions', {
  ref: 'Subscription',
  localField: '_id',
  foreignField: 'botUser',
});

// 新增 displayName 虚拟属性
botUserSchema.virtual('displayName').get(function (this: any) {
  // 优先 userName，其次 firstName + lastName
  if (this.userName) {
    return this.userName;
  }
  const first = this.firstName || '';
  const last = this.lastName || '';
  return `${first} ${last}`.trim();
});

const BotUser = mongoose.model<IBotUser>('BotUser', botUserSchema);

export default BotUser;
