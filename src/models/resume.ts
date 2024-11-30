import mongoose, { Document } from 'mongoose';

export interface IResume extends Document {
  _id: string;
  customer: mongoose.Types.ObjectId; // 关联的客户ID

  // 基本信息
  fullName: string; // 全名
  birthDate?: Date; // 出生日期
  location?: string; // 所在地

  // 教育背景
  degree: string; // 最高学历
  school: string; // 毕业院校
  major: string; // 专业

  // 教学信息
  teachingYears: number; // 教学年限
  subjects: string[]; // 教授科目
  teachingLevel: string; // 教学层级（小学/初中/高中等）

  // 系统字段
  status: 'draft' | 'published'; // 简历状态
  lastUpdated: Date; // 最后更新时间
  createdAt: Date;
  updatedAt: Date;
}

const resumeSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    fullName: { type: String, required: true, trim: true },
    birthDate: Date,
    location: String,

    degree: {
      type: String,
      required: true,
      enum: ['Bachelor', 'Master', 'Doctor', 'Other'],
    },
    school: { type: String, required: true },
    major: String,

    teachingYears: { type: Number, default: 0 },
    subjects: [String],
    teachingLevel: {
      type: String,
      enum: ['Primary', 'Junior', 'Senior', 'College', 'Other'],
      required: true,
    },

    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    lastUpdated: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

// 添加索引
resumeSchema.index({ customerId: 1 });
resumeSchema.index({ status: 1 });
resumeSchema.index({ lastUpdated: -1 });

const Resume = mongoose.model<IResume>('Resume', resumeSchema);

export default Resume;
