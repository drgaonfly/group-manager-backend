import mongoose, { Document } from 'mongoose';

export interface IBot extends Document {
  token: string;
  botName: string;
  remark?: string;
  user: mongoose.Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  message: string;
  userName: string;
  menu: {
    menuName: string;
    url: string;
  }[];
  isOnline: boolean;
}

const menuSchema = new mongoose.Schema({
  menuName: { type: String, required: true },
  url: { type: String, required: true },
});

const botSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      trim: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    botName: {
      type: String,
      trim: true,
    },
    remark: {
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
    isOnline: {
      type: Boolean,
      default: true,
    },
    menu: [menuSchema],
  },
  {
    timestamps: true,
  },
);

const Bot = mongoose.model<IBot>('Bot', botSchema);

export default Bot;
