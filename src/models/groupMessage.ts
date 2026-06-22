import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IGroup } from './group';
import { IUser } from './user';

export interface IMenu extends Document {
  name: string;
  url: string;
  row: number;
}

export const menuSchema = new mongoose.Schema({
  name: { type: String, required: true },
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
  row: { type: Number, required: false, default: 0 },
});

// 只存客户发给机器人的消息（toBot），不存机器人发给客户的消息（fromBot）
export interface IGroupMessage extends Document {
  bot: mongoose.Schema.Types.ObjectId | IBot; // 关联的机器
  content: string; // 消息内容
  group?: mongoose.Schema.Types.ObjectId | IGroup; // 关联的群（单群配置）
  proxy: mongoose.Types.ObjectId | IUser;
  medias: string[]; // 媒体文件（图片、视频等）
  intervalTime: number; // 间隔时间（单位：分钟）
  isRealtime: boolean; // 是否实时
  menus: IMenu[];
  weight: number; // 权重
  isOnline: boolean;
  autoDeletePrevious: boolean; // 发新消息前自动删除上一条已发送的消息
  startAt: Date; // 发送时间窗口开始
  endAt: Date; // 发送时间窗口结束
  createdAt: Date; // 创建时间
  updatedAt: Date; // 更新时间
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
