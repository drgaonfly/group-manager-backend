// models/subscription.ts
import mongoose, { Document } from 'mongoose';
import { IBotUser } from './botUser';

export enum SubscriptionPlan {
  // Half Month
  Weekly = 'weekly',
  Biweekly = 'biweekly',
  Monthly = 'monthly',
  Quarterly = 'quarterly',
}

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
  isAuto: boolean;
  isTrial: boolean;
}

const subscriptionSchema = new mongoose.Schema(
  {
    botUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      required: true,
    },
    plan: {
      type: String,
      enum: Object.values(SubscriptionPlan),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.Active,
      required: true,
    },
    isAuto: { type: Boolean, default: false },
    isTrial: { type: Boolean, default: false },
    createdAt: { type: Date, required: true },
    expiredAt: { type: Date, required: true },
  },
  { timestamps: true },
);

subscriptionSchema.index({ botUser: 1, status: 1 });

export default mongoose.model<ISubscription>(
  'Subscription',
  subscriptionSchema,
);
