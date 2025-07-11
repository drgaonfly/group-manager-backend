import mongoose, { Document } from 'mongoose';
import {
  ISubscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from './subscription';
import { IBotUser } from './botUser';
import { IBot } from './bot';

export enum UserStatus {
  UNAUTHORIZED = 'unauthorized', // 未授权
  TRIAL = 'trial', // 试用中
  TRIAL_EXPIRED = 'trialExpired', // 试用过期
  AUTHORIZED = 'authorized', // 已授权
  SUBSCRIPTION_EXPIRED = 'subscriptionExpired', // 授权过期
}

// Bot和User的关系表接口定义
export interface IBotUserConfig extends Document {
  bot: mongoose.Types.ObjectId | IBot;
  botUser: mongoose.Types.ObjectId | IBotUser;
  subscription?: mongoose.Types.ObjectId | ISubscription;
  status: UserStatus;
  trialEndDate?: Date;
  subscriptionEndDate?: Date;
  currentPlan?: SubscriptionPlan;
  isAutoRenew: boolean;
  usdt_balance: number; // 用户余额
  trx_balance: number; // 用户余额
  parent: mongoose.Types.ObjectId | IBotUserConfig;
  spread_code: string;
  createdAt: Date;
  updatedAt: Date;
}

// Bot和User关系表Schema
const botUserConfigSchema = new mongoose.Schema(
  {
    bot: { type: mongoose.Schema.Types.ObjectId, ref: 'Bot', required: true },
    botUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.UNAUTHORIZED,
      required: true,
    },
    trialEndDate: {
      type: Date,
      required: false,
    },
    subscriptionEndDate: {
      type: Date,
      required: false,
    },
    currentPlan: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      required: false,
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: false,
    },
    isAutoRenew: {
      type: Boolean,
      required: true,
      default: true,
    },
    usdt_balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0, // 余额不能小于0
    },
    trx_balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0, // 余额不能小于0
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUserConfig',
      required: false,
    },
    spread_code: {
      type: String,
      unique: true,
    },
  },
  {
    timestamps: true,
  },
);

botUserConfigSchema.index({ bot: 1, botUser: 1 }, { unique: true });

const BotUserConfig = mongoose.model<IBotUserConfig>(
  'BotUserConfig',
  botUserConfigSchema,
);

export default BotUserConfig;
