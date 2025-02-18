// Start of Selection
import mongoose, { Document } from 'mongoose';

export interface IRegulationAgency extends Document {
  id: string; // 合作伙伴ID
  logoUrl: string; // 合作伙伴图标 URL
  createdAt: Date;
  updatedAt: Date;
}

const regulationAgencySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    logoUrl: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true, // 自动生成 createdAt 和 updatedAt 字段
  },
);

const RegulationAgency = mongoose.model<IRegulationAgency>(
  'RegulationAgency',
  regulationAgencySchema,
);

export default RegulationAgency;
