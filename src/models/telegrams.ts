import mongoose, { Document } from 'mongoose';

export interface ITelegram extends Document {
  _id: string;
  botToken: string;
  url: string;
  botName: string;
  isActive: boolean;
  remarks?: string;
  user: mongoose.Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  message: string;
  name: string;
}

const telegramSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    botToken: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
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
  },
  {
    timestamps: true,
  },
);

const Telegram = mongoose.model<ITelegram>('Telegram', telegramSchema);

export default Telegram;
