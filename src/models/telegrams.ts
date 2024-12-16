import mongoose, { Document } from 'mongoose';

export interface ITelegram extends Document {
  _id: string;
  botToken: string;
  url: string;
  botName: string;
  isActive: boolean;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
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
    botName: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    remarks: {
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
