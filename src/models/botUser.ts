import mongoose, { Document } from 'mongoose';
import { IBotUserMessage } from './botUserMessage';
import { SubscriptionPlan } from './subscription';

export enum UserStatus {
  UNAUTHORIZED = 'unauthorized', // 未授权
  TRIAL = 'trial', // 试用中
  TRIAL_EXPIRED = 'trialExpired', // 试用过期
  AUTHORIZED = 'authorized', // 已授权
}

export interface IBotUser extends Document {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  messages: mongoose.Types.ObjectId[] | IBotUserMessage[];
  status: UserStatus;
  // trialEndDate: Date | null;
  // subscriptionEndDate?: Date;
  currentPlan?: SubscriptionPlan;
  isTrailed?: boolean;
}

const botUserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    userName: { type: String, required: false },
    firstName: { type: String, required: false },
    lastName: { type: String, required: false },
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BotUserMessage' }],
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.UNAUTHORIZED,
      required: true,
    },
    // trialEndDate: {
    //   type: Date,
    //   required: false,
    //   default: null,
    // },
    // subscriptionEndDate: {
    //   type: Date,
    //   required: false,
    //   default: null,
    // },
    currentPlan: {
      type: String,
      enum: Object.values(SubscriptionPlan),
      required: false,
    },
    isTrailed: {
      type: Boolean,
      required: false,
      default: false,
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

const BotUser = mongoose.model<IBotUser>('BotUser', botUserSchema);

export default BotUser;
