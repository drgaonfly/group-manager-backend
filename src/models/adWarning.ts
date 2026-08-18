import mongoose, { Document } from 'mongoose';

export interface IAdWarning extends Document {
  ruleId: string;
  chatId: number;
  userId: number;
  count: number;
  expiresAt: Date;
}

const adWarningSchema = new mongoose.Schema({
  ruleId: { type: String, required: true },
  chatId: { type: Number, required: true },
  userId: { type: Number, required: true },
  count: { type: Number, default: 1 },
  expiresAt: { type: Date, required: true },
});

// 复合唯一索引：一个规则+群+用户只有一条记录
adWarningSchema.index({ ruleId: 1, chatId: 1, userId: 1 }, { unique: true });

// TTL 索引：expiresAt 到期后 MongoDB 自动删除文档，无需手动清理
adWarningSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AdWarning = mongoose.model<IAdWarning>('AdWarning', adWarningSchema);

export default AdWarning;
