// models/subscription.ts
import mongoose, { Document } from 'mongoose';
import { IBotUser } from './botUser';
import { IBot } from './bot';

export type SubscriptionStatus =
  | 'pending' // 已创建，等待链上付款
  | 'paid' // 已确认到账，订阅生效
  | 'expired' // 订阅已到期
  | 'timeout'; // 订单超时未付款

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

export interface ISubscription extends Document {
  id: string;
  botUser: mongoose.Types.ObjectId | IBotUser;
  bot: mongoose.Types.ObjectId | IBot;

  /** 订阅计划（包月/季度等） */
  plan: SubscriptionPlan;

  /** 应付金额（USDT） */
  amount: number;

  /** 订阅天数 */
  days: number;

  /** 收款地址（创建时快照） */
  toAddress: string;

  /** 链上交易哈希（付款确认后填入） */
  txHash?: string;

  /** 付款来源地址（付款确认后填入） */
  fromAddress?: string;

  /** 实际到账金额（付款确认后填入） */
  paidAmount?: number;

  /** 付款确认时间 */
  paidAt?: Date;

  /** 订单超时时间（pending 状态下超过此时间则自动 timeout） */
  orderExpiredAt: Date;

  /** 本次订阅服务开始时间（付款确认后填入） */
  startDate?: Date;

  /** 本次订阅服务结束时间（付款确认后填入） */
  endDate?: Date;

  status: SubscriptionStatus;

  /** 是否已发送到期提醒 */
  preExpirationNotified?: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new mongoose.Schema<ISubscription>(
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
    amount: {
      type: Number,
      required: true,
    },
    days: {
      type: Number,
      required: true,
    },
    toAddress: {
      type: String,
      required: true,
      trim: true,
    },
    txHash: {
      type: String,
      trim: true,
      sparse: true,
    },
    fromAddress: {
      type: String,
      trim: true,
    },
    paidAmount: {
      type: Number,
    },
    paidAt: {
      type: Date,
    },
    orderExpiredAt: {
      type: Date,
      required: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'expired', 'timeout'],
      default: 'pending',
      required: true,
    },
    preExpirationNotified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

subscriptionSchema.index({ botUser: 1, bot: 1 });
subscriptionSchema.index({ status: 1, orderExpiredAt: 1 });
subscriptionSchema.index({ status: 1, endDate: 1 });
// txHash 唯一但允许为空（sparse）
subscriptionSchema.index({ txHash: 1 }, { unique: true, sparse: true });

export default mongoose.model<ISubscription>(
  'Subscription',
  subscriptionSchema,
);
