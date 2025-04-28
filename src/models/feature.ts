import mongoose, { Document } from 'mongoose';
// 定义特性接口
export interface IFeature extends Document {
  title: string;
  text: string;
  image: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// 创建特性模型的Schema
const featureSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    text: { type: String, required: true },
    image: { type: String, required: true },
  },
  { timestamps: true },
);

// 创建并导出Feature模型
const Feature = mongoose.model<IFeature>('Feature', featureSchema);

export default Feature;
