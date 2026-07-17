import mongoose, { Document } from 'mongoose';

export interface ISubscriptionPlan {
  months: number;
  price: number;
  label: string;
}

export interface ISetting extends Document {
  defaultFreeDays: number;
  trx20Address: string;
  subscriptionPlans: ISubscriptionPlan[];
  orderTimeoutMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const settingSchema = new mongoose.Schema(
  {
    defaultFreeDays: {
      type: Number,
      default: 3,
      required: true,
    },
    trx20Address: {
      type: String,
      default: process.env.TRX20_ADDRESS,
      trim: true,
    },
    subscriptionPlans: [
      {
        months: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        label: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],
    orderTimeoutMinutes: {
      type: Number,
      default: 15,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const Setting = mongoose.model<ISetting>('Setting', settingSchema);

export default Setting;
