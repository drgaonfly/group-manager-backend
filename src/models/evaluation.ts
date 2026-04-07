import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IBotUser } from './botUser';
import { ITeacher } from './teacher';

// 评价接口定义
export interface IEvaluation extends Document {
  bot: mongoose.Schema.Types.ObjectId | IBot;
  reviewer: mongoose.Schema.Types.ObjectId | IBotUser;
  teacher: mongoose.Schema.Types.ObjectId | ITeacher;
  avatar_rating: number; // 人照评分
  appearance_rating: number; // 颜值评分
  body_rating: number; // 身材评分
  service_rating: number; // 服务评分
  attitude_rating: number; // 态度评分
  circumstance_rating: number; // 环境评分
  process_desc: string; // 过程描述
  proof_media: string[]; // 证明约了老师的图片/视频
  isReportedAnoymously: boolean; // 是否匿名展示报告
  status: string;
  remark: string;
  createdAt: Date;
}

// 评价 Schema
const evaluationSchema = new mongoose.Schema(
  {
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      required: false,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    avatar_rating: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
    },
    appearance_rating: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
    },
    body_rating: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
    },
    service_rating: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
    },
    attitude_rating: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
    },
    circumstance_rating: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
    },
    process_desc: {
      type: String,
      required: true,
    },
    proof_media: {
      type: [String],
      default: [],
    },
    isReportedAnoymously: {
      type: Boolean,
      default: false,
    },
    remark: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// 添加联合索引: reviewer, teacher, bot
evaluationSchema.index({ reviewer: 1, teacher: 1, bot: 1 }, { unique: false });

const Evaluation = mongoose.model<IEvaluation>('Evaluation', evaluationSchema);

export default Evaluation;
