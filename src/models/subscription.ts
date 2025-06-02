// models/subscription.ts
import mongoose, { Document } from 'mongoose';
import { IBotUser } from './botUser';
import { IPayment } from './payment';
import { IBot } from './bot';

export interface RenewalOption {
  days: number;
  price: number;
  type: string;
  label: string;
}

export const renewalOptions: Record<string, RenewalOption> = {
  biweekly: {
    days: 15,
    price: 30,
    type: 'subscribe:biweekly',
    label: '15天',
  },
  monthly: {
    days: 30,
    price: 50,
    type: 'subscribe:monthly',
    label: '一个月',
  },
  quarterly: {
    days: 90,
    price: 120,
    type: 'subscribe:quarterly',
    label: '三个月',
  },
};

export type SubscriptionPlan = keyof typeof renewalOptions;

export enum SubscriptionStatus {
  Active = 'active',
  Expired = 'expired',
  Canceled = 'canceled',
}

export interface ISubscription extends Document {
  botUser: mongoose.Types.ObjectId | IBotUser;
  bot: mongoose.Types.ObjectId | IBot;
  createdAt: Date;
  expiredAt: Date;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  isAutoRenew: boolean;
  id: string;
  payment: mongoose.Types.ObjectId | IPayment;
  isRenewal?: boolean; // 是否续费类型
}

const subscriptionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    botUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      required: true,
    },
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
    },
    plan: {
      type: String,
      enum: Object.keys(renewalOptions),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.Active,
      required: true,
    },
    isAutoRenew: { type: Boolean, default: true },
    expiredAt: { type: Date, required: true },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
    },
    isRenewal: { type: Boolean, default: false }, // 是否续费类型，默认 false
  },
  { timestamps: true },
);

subscriptionSchema.index({ botUser: 1, bot: 1 });

export default mongoose.model<ISubscription>(
  'Subscription',
  subscriptionSchema,
);
