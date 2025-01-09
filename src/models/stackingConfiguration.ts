import mongoose, { Document } from 'mongoose';

export interface IStackingConfiguration extends Document {
  investBalance: number;
  rateOfReturn: number;
  profit: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const stackingConfigurationSchema = new mongoose.Schema(
  {
    investBalance: { type: Number, required: true },
    rateOfReturn: { type: Number, required: true },
    profit: { type: Number, required: true },
  },
  {
    timestamps: true,
  },
);

const StackingConfiguration = mongoose.model<IStackingConfiguration>(
  'StackingConfiguration',
  stackingConfigurationSchema,
);

export default StackingConfiguration;
