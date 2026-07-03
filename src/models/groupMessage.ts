import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IGroup } from './group';
import { IUser } from './user';

export interface IMenu extends Document {
  name: string;
  type?: 'url' | 'callback' | 'copy_text';
  url?: string;
  callback?: string; // 弹窗显示文字
  callback_data?: string; // Telegram callback_data（随机短 ID）
  copy_text?: string;
  row: number;
  style?: 'primary' | 'success' | 'danger';
}

export const menuSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['url', 'callback', 'copy_text'],
    required: true,
    default: 'url',
  },
  url: {
    type: String,
    required: false,
    validate: {
      validator: function (v: string): boolean {
        if (!v) return true;
        return /^(http|https):\/\/.*/.test(v);
      },
      message: (props: any): string => `${props.value} 不是一个有效的 URL!`,
    },
  },
  callback: { type: String, required: false },
  callback_data: { type: String, required: false },
  copy_text: { type: String, required: false },
  row: { type: Number, required: false, default: 1 },
  style: {
    type: String,
    enum: ['primary', 'success', 'danger'],
    required: false,
  },
});

// 只存客户发给机器人的消息（toBot），不存机器人发给客户的消息（fromBot）
export interface IGroupMessage extends Document {
  bot: mongoose.Schema.Types.ObjectId | IBot;
  content: string;
  group?: mongoose.Schema.Types.ObjectId | IGroup;
  proxy: mongoose.Types.ObjectId | IUser;
  medias: string[];
  intervalTime: number;
  isRealtime: boolean;
  sendType: 'immediate' | 'scheduled';
  menus: IMenu[];
  weight: number;
  isOnline: boolean;
  autoDeletePrevious: boolean;
  startAt: Date;
  endAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const groupMessageSchema = new mongoose.Schema(
  {
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
    },
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    medias: {
      type: [String],
      required: false,
    },
    content: {
      type: String,
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: false,
    },
    intervalTime: {
      type: Number,
      required: false,
    },
    isRealtime: {
      type: Boolean,
      required: false,
    },
    sendType: {
      type: String,
      enum: ['immediate', 'scheduled'],
      required: false,
      default: 'scheduled',
    },
    menus: [menuSchema],
    weight: {
      type: Number,
      required: false,
      default: 0,
    },
    isOnline: {
      type: Boolean,
      required: false,
      default: true,
    },
    autoDeletePrevious: {
      type: Boolean,
      required: false,
      default: false,
    },
    startAt: {
      type: Date,
      required: false,
    },
    endAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

const GroupMessage = mongoose.model<IGroupMessage>(
  'GroupMessage',
  groupMessageSchema,
);

export default GroupMessage;
