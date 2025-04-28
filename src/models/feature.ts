import mongoose, { Document } from 'mongoose';

// 定义特性接口
export interface IFeature extends Document {
  title: string;
  text: string;
  icon: string;
  type: 'feature' | 'step'; // 新增type字段，区分项目特点和邀请步骤
  lang:
    | 'en'
    | 'zh'
    | 'zh-TW'
    | 'ja'
    | 'ko'
    | 'it'
    | 'fr'
    | 'pt'
    | 'ru'
    | 'ar'
    | 'hi'
    | 'bg'
    | 'es'
    | 'de'
    | 'tr';
  createdAt?: Date;
  updatedAt?: Date;
}

// 创建特性模型的Schema
const featureSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    text: { type: String, required: true },
    icon: { type: String, required: true },
    type: {
      type: String,
      enum: ['feature', 'step'],
      required: true,
      default: 'feature',
    },
    lang: {
      type: String,
      enum: [
        'en',
        'zh',
        'zh-TW',
        'ja',
        'ko',
        'it',
        'fr',
        'pt',
        'ru',
        'ar',
        'hi',
        'bg',
        'es',
        'de',
        'tr',
      ],
      required: true,
    },
  },
  { timestamps: true },
);

// 创建并导出Feature模型
const Feature = mongoose.model<IFeature>('Feature', featureSchema);

export default Feature;
