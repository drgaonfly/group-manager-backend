import mongoose, { Document } from 'mongoose';

export interface ITelegram extends Document {
  _id: string;
  token: string;
  botName: string;
  isActive: boolean;
  remarks?: string;
  user: mongoose.Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  message: string;
  name: string;
  priceList: {
    menuName: string;
    url: string;
  }[];
}

const priceListSchema = new mongoose.Schema({
  menuName: { type: String, required: true },
  url: { type: String, required: true },
});

const botSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    name: {
      type: String,
      trim: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    message: {
      type: String,
      trim: true,
    },
    userName: { type: String, required: false },
    priceList: [priceListSchema],
  },
  {
    timestamps: true,
  },
);

const Bot = mongoose.model<ITelegram>('Bot', botSchema);

export default Bot;
