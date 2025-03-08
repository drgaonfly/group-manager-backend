import mongoose, { Document } from 'mongoose';

export interface ILiquidityBenefits extends Document {
  stakingmin: number;
  stakingmax: number;
  rewards: number;
  profitmax: number;
  profitmin: number;
}

const liquidityBenefitsSchema = new mongoose.Schema(
  {
    stakingmin: { type: Number, required: true },
    stakingmax: { type: Number, required: true },
    rewards: { type: Number, required: true },
    profitmax: { type: Number, required: true },
    profitmin: { type: Number, required: true },
  },
  { timestamps: true },
);

const LiquidityBenefits = mongoose.model<ILiquidityBenefits>(
  'LiquidityBenefits',
  liquidityBenefitsSchema,
);

export default LiquidityBenefits;
