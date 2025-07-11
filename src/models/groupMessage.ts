import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IGroup } from './group';

export interface IMenu extends Document {
  menuName: string;
  url: string;
}

export const menuSchema = new mongoose.Schema({
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

// 只存客户发给机器人的消息（toBot），不存机器人发给客户的消息（fromBot）
export interface IGroupMessage extends Document {
  bot: mongoose.Schema.Types.ObjectId | IBot; // 关联的机器
  content: string; // 消息内容
  groups?: mongoose.Schema.Types.ObjectId[] | IGroup[]; // 关联的群（如果是群消息）
  image: string; // 图片
  intervalTime: number; // 间隔时间
  isRealtime: boolean; // 是否实时
  menus: IMenu[];
  menus_per_row: number; // 每行菜单数
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
    image: {
      type: String,
      required: false,
    },
    content: {
      type: String,
      required: true,
    },
    groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    intervalTime: {
      type: Number,
      required: false,
    },
    isRealtime: {
      type: Boolean,
      required: false,
    },
    menus: [menuSchema],
    menus_per_row: {
      type: Number,
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
