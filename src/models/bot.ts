import mongoose, { Document } from 'mongoose';
import { IUser } from './user';

export interface IBot extends Document {
  token: string;
  botName: string;
  remark?: string;
  user: mongoose.Schema.Types.ObjectId | IUser;
  createdAt: Date;
  updatedAt: Date;
  message: string;
  userName: string;
  menus: IMenu[];
  isOnline: boolean;
  fee_rate: number;
  exchange_rate: number;
}

export interface IMenu extends Document {
  menuName: string;
  url: string;
}

const menuSchema = new mongoose.Schema({
  menuName: { type: String, required: true },
  url: {
    type: String,
    required: true,
    validate: {
      validator: function (v: string): boolean {
        return /^(http|https):\/\/.*/.test(v);
      },
      message: (props: any): string => `${props.value} 不是一个有效的 URL!`,
    },
  },
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
    menus: [menuSchema],
    exchange_rate: {
      type: Number,
      default: 1,
    },
    fee_rate: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

const Bot = mongoose.model<IBot>('Bot', botSchema);

export default Bot;
