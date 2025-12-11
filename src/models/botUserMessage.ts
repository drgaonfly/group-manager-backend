import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IBotUser } from './botUser';
import { IUser } from './user';

export interface IMenu extends Document {
  menuName: string;
  url: string;
}

export const menuSchema = new mongoose.Schema({
  menuName: { type: String, required: false },
  url: {
    type: String,
    required: false,
    validate: {
      validator: function (v: string): boolean {
        return /^(http|https):\/\/.*/.test(v);
      },
      message: (props: any): string => `${props.value} 不是一个有效的 URL!`,
    },
  },
});

export interface IBotUserMessage extends Document {
  content: string;
  type: 'sent' | 'received' | 'error';
  bot: mongoose.Schema.Types.ObjectId | IBot;
  proxy: mongoose.Types.ObjectId | IUser;
  botUsers: mongoose.Schema.Types.ObjectId[] | IBotUser[];
  intervalTime: number; // 间隔时间
  menus: IMenu[];
  menus_per_row: number; // 每行菜单数
  weight: number; // 权重
  isOnline: boolean; // 是否在线
  images: string[];
  updatedAt: Date;
  createdAt: Date;
}

const botUserMessageSchema = new mongoose.Schema(
  {
    content: { type: String, required: false },
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    type: {
      type: String,
      enum: ['sent', 'received', 'error'],
      default: 'sent',
      required: true,
    },
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
    },
    botUsers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'BotUser',
      required: false,
    },
    intervalTime: {
      type: Number,
      required: false,
    },
    menus: [menuSchema],
    menus_per_row: {
      type: Number,
      required: false,
    },
    weight: {
      type: Number,
      required: false,
      default: 0,
    },
    isOnline: {
      type: Boolean,
      required: false,
      default: false,
    },
    images: {
      type: [String],
      required: false,
    },
  },
  { timestamps: true },
);

const BotUserMessage = mongoose.model<IBotUserMessage>(
  'BotUserMessage',
  botUserMessageSchema,
);

export default BotUserMessage;
