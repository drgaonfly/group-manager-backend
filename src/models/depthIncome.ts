import mongoose, { Document } from 'mongoose';

export interface IDepthIncome extends Document {
  depth: number; // 深度层级
  incomeRate: number; // 收益率
}

const depthIncomeSchema = new mongoose.Schema(
  {
    depth: {
      type: Number,
      required: true,
    },
    incomeRate: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true },
);

const DepthIncome = mongoose.model<IDepthIncome>(
  'DepthIncome',
  depthIncomeSchema,
);

export default DepthIncome;
