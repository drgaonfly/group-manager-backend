import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  country: string;
  platform: string;
  file: string; // 假设这可能是一个URL或文件路径
  uploadedFile: string; // 上传文件路径或URL
  billFile?: string; // 账单文件路径或URL，可选字段
  user: Schema.Types.ObjectId; // 对User模型的引用
  orderTime: Date; // 下单时间
  orderTimeType: 'NormalOrder' | 'SpecificTimeOrder'; // 下单时间类型
  orderNote?: string; // 下单备注，可选字段
  reviewType?: 'NormalReview' | 'ReviewAfterModification'; // 评价类型
  reviewFile?: string; // 评价文件路径或URL，用于评价后补
  status: 'Active' | 'Cancelled' | 'Processing' | 'Completed' | 'Issue';
  quantity: number; // 单量
  orderType: ('NormalOrder' | 'ContactForVolumeWeight' | 'ContactForInventory' | 'ContactForPrice')[];
  createdAt?: Date; // Time of document creation
  updatedAt?: Date; // Time the document was last updated
}

const TaskSchema: Schema = new Schema({
  country: { type: String, required: true },
  platform: { type: String, required: true },
  file: { type: String, required: true },
  uploadedFile: { type: String, required: false },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  orderTime: { type: Date, required: false },
  orderTimeType: { type: String, required: true, enum: ['NormalOrder', 'SpecificTimeOrder'], default: 'NormalOrder' }, // 下单时间类型
  orderNote: { type: String, required: false, default: '' }, // 下单备注，默认为空字符串
  reviewType: { type: String, required: true, enum: ['NormalReview', 'ReviewAfterModification'], default: 'NormalReview' }, // 评价类型，默认为'NormalReview'
  reviewFile: { type: String, required: false }, // 评价文件路径或URL，可选字段
  status: {
    type: String,
    required: true,
    enum: ['Active', 'Cancelled', 'Processing', 'Completed', 'Issue'],
    default: 'Active'
  },
  billFile: { type: String, required: false }, // 新增账单文件字段，可选
  quantity: { type: Number, required: true }, // 单量
  orderType: {
    type: [{ type: String, enum: ['NormalOrder', 'ContactForVolumeWeight', 'ContactForInventory', 'ContactForPrice'] }],
    default: ['NormalOrder']
  }
}, { timestamps: true });

export default mongoose.model<ITask>('Task', TaskSchema);