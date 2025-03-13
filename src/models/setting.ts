import mongoose, { Document } from 'mongoose';

export interface ISetting extends Document {
  id: string;
  parameter: string; // 设置参数
  key: string; // 设置的 key
  value: string; // 设置的 value
  max: number; // 添加最大值
  min: number; // 添加最小值
  remark: string; // 备注
}

const settingSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    parameter: { type: String, required: true, trim: true }, // 去除空格
    key: { type: String, unique: true, required: true, trim: true },
    value: { type: String, required: true },
    max: { type: Number }, // 添加增长范围最大值字段
    min: { type: Number }, // 添加增长范围最小值字段
    remark: { type: String, default: '' }, // 默认空字符串
  },
  {
    timestamps: true, // 自动生成 createdAt 和 updatedAt 字段
  },
);

const Setting = mongoose.model<ISetting>('Setting', settingSchema);

export default Setting;
