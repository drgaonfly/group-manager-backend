import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';

export interface IPromotionLink extends Document {
  title: string;
  remark?: string;
  link: string;
  code: string; // 随机码，6-8位字母，唯一
  bot: mongoose.Schema.Types.ObjectId | IBot; // 关联的机器人
  createdAt: Date;
  updatedAt: Date;
}

const promotionLinkSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    remark: {
      type: String,
      required: false,
      trim: true,
    },
    link: {
      type: String,
      required: false,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// 确保 code 字段有索引
promotionLinkSchema.index({ code: 1 }, { unique: true });

const PromotionLink = mongoose.model<IPromotionLink>(
  'PromotionLink',
  promotionLinkSchema,
);

export default PromotionLink;
