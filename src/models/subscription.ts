// models/subscription.ts
import mongoose, { Document } from 'mongoose';
import { IBotUser } from './botUser';

export interface RenewalOption {
  days: number;
  price: number;
  type: string;
  label: string;
}

export const renewalOptions: Record<string, RenewalOption> = {
  biweekly: {
    days: 15,
    price: 60,
    type: 'subscribe:biweekly',
    label: '15天',
  },
  monthly: {
    days: 30,
    price: 100,
    type: 'subscribe:monthly',
    label: '一个月',
  },
  quarterly: {
    days: 90,
    price: 230,
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
  createdAt: Date;
  expiredAt: Date;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  isAutoRenew: boolean;
}

const subscriptionSchema = new mongoose.Schema(
  {
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
  },
  { timestamps: true },
);

subscriptionSchema.index({ botUser: 1, bot: 1 });

export default mongoose.model<ISubscription>(
  'Subscription',
  subscriptionSchema,
);
