import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IUser } from './user';

export interface IBadge extends Document {
  bot: mongoose.Types.ObjectId | IBot;
  proxy: mongoose.Types.ObjectId | IUser;
  title: string; // 称号名称，如 "传奇" / "💎 钻石会员"
  threshold: number; // 累计积分门槛（达到此积分即授予该称号）
  order: number; // 排序权重，threshold 越高 order 越大，查询时用于排序
}

const badgeSchema = new mongoose.Schema<IBadge>(
  {
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
      index: true,
    },
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    threshold: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// 同一个 bot 下按 threshold 降序查询（取最高匹配称号）
badgeSchema.index({ bot: 1, threshold: -1 });

const Badge = mongoose.model<IBadge>('Badge', badgeSchema);

export default Badge;
