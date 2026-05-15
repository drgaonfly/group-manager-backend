import mongoose, { Document } from 'mongoose';
import {
  ISubscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from './subscription';
import { IBotUser } from './botUser';
import { IBot } from './bot';
import { IUser } from './user';

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
  proxy: mongoose.Types.ObjectId | IUser;
  botUser: mongoose.Types.ObjectId | IBotUser;
  subscription?: mongoose.Types.ObjectId | ISubscription;
  status: UserStatus;
  trialEndDate?: Date;
  subscriptionEndDate?: Date;
  currentPlan?: SubscriptionPlan;
  isAutoRenew: boolean;
  usdt_balance: number; // 用户余额
  trx_balance: number; // 用户余额
  promotionLink?: mongoose.Types.ObjectId; // 关联的推广链接
  /** 用户上次更新的位置坐标，用于附近老师搜索 */
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  createdAt: Date;
  updatedAt: Date;
}

// Bot和User关系表Schema
const botUserConfigSchema = new mongoose.Schema(
  {
    bot: { type: mongoose.Schema.Types.ObjectId, ref: 'Bot', required: true },
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
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
    promotionLink: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PromotionLink',
      required: false,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: false,
      },
      coordinates: {
        type: [Number],
        required: false,
        default: undefined, // 禁止 Mongoose 自动填充空数组默认值
      },
    },
  },
  {
    timestamps: true,
  },
);

botUserConfigSchema.index({ bot: 1, botUser: 1 }, { unique: true });
// sparse: 没有 location 的文档不参与索引，不报错
botUserConfigSchema.index({ location: '2dsphere' }, { sparse: true });

/**
 * 清理无效的 location 字段（coordinates 为空数组时视为无效，直接 unset）
 * 防止 2dsphere 索引因空坐标报 Location16755 错误
 */
function stripInvalidLocation(doc: any) {
  if (
    doc.location &&
    Array.isArray(doc.location.coordinates) &&
    doc.location.coordinates.length !== 2
  ) {
    doc.location = undefined;
  }
}

botUserConfigSchema.pre('save', function (next) {
  stripInvalidLocation(this);
  next();
});

// findOneAndUpdate / updateOne / updateMany 等走这里
botUserConfigSchema.pre(
  ['findOneAndUpdate', 'updateOne', 'updateMany'],
  function (next) {
    const update = this.getUpdate() as any;
    if (update?.$setOnInsert?.location) {
      stripInvalidLocation(update.$setOnInsert);
    }
    if (update?.$set?.location) {
      stripInvalidLocation(update.$set);
    }
    if (update?.location) {
      stripInvalidLocation(update);
    }
    next();
  },
);

const BotUserConfig = mongoose.model<IBotUserConfig>(
  'BotUserConfig',
  botUserConfigSchema,
);

export default BotUserConfig;
