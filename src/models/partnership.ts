import mongoose, { Document } from 'mongoose';

export interface IPartnership extends Document {
  id: string; // 合作伙伴ID
  name: string; // 合作伙伴名称
  logoUrl: string; // 合作伙伴图标 URL
  website: string; // 合作伙伴官网
  createdAt: Date;
  updatedAt: Date;
}

const partnershipSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    logoUrl: {
      type: String,
      required: true,
    },
    website: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true, // 自动生成 createdAt 和 updatedAt 字段
  },
);

const Partnership = mongoose.model<IPartnership>(
  'Partnership',
  partnershipSchema,
);

export default Partnership;
