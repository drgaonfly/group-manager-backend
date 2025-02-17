import mongoose, { Document } from 'mongoose';

export interface IMiningData extends Document {
  totalOutput: number;
  validNodes: number;
  participants: number;
  userEarnings: number;
}

const miningDataSchema = new mongoose.Schema(
  {
    totalOutput: { type: Number, default: 0 }, // 总产量
    validNodes: { type: Number, default: 0 }, // 有效节点
    participants: { type: Number, default: 0 }, // 参加人数
    userEarnings: { type: Number, default: 0 }, // 用户收益
  },
  { timestamps: true },
);

const MiningData = mongoose.model<IMiningData>('MiningData', miningDataSchema);

export default MiningData;
