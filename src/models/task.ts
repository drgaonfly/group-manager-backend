import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  country: string;
  file: string; // 假设这可能是一个URL或文件路径
  uploadedFile: string; // 上传文件路径或URL
  user: Schema.Types.ObjectId; // 对User模型的引用
  orderTime: Date; // 下单时间
  orderType: 'NormalOrder' | 'SpecificTimeOrder'; // 下单类型
  orderNote?: string; // 下单备注，可选字段
  reviewType?: 'NormalReview' | 'ReviewAfterModification'; // 评价类型
  reviewFile?: string; // 评价文件路径或URL，用于评价后补
}

const TaskSchema: Schema = new Schema({
  country: { type: String, required: true },
  file: { type: String, required: true },
  uploadedFile: { type: String, required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  orderTime: { type: Date, required: true },
  orderType: { type: String, required: true, default: 'NormalOrder' },
  orderNote: { type: String, required: false, default: '' }, // 下单备注，默认为空字符串
  reviewType: { type: String, required: false, default: 'NormalReview' }, // 评价类型，默认为'NormalReview'
  reviewFile: { type: String, required: false }, // 评价文件路径或URL，可选字段
}, { timestamps: true });

export default mongoose.model<ITask>('Task', TaskSchema);