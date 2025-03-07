import mongoose, { Document } from 'mongoose';

export interface ISetting extends Document {
  id: string;
  parameter: string; // 设置参数
  key: string; // 设置的 key
  value: string; // 设置的 value
  isVisible: boolean; // 是否可见
  remark: string; // 备注
  createdAt: Date;
  updatedAt: Date;
}

const settingSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true },
    parameter: { type: String, trim: true }, // 去除空格
    key: { type: String, trim: true },
    value: { type: String },
    isVisible: { type: Boolean, required: true, default: true }, // 默认可见
    remark: { type: String, default: '' }, // 默认空字符串
    revenuePool: { type: Number }, //收益池
    incomePool: { type: Number }, // 玩家收入
    StakingApy: { type: Number }, // 质押 apy
  },
  {
    timestamps: true, // 自动生成 createdAt 和 updatedAt 字段
  },
);

const Setting = mongoose.model<ISetting>('Setting', settingSchema);

export default Setting;
