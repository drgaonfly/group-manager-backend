import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IGroup } from './group';

// 只存客户发给机器人的消息（toBot），不存机器人发给客户的消息（fromBot）
export interface IGroupMessage extends Document {
  bot: mongoose.Schema.Types.ObjectId | IBot; // 关联的机器人
  content: string; // 消息内容
  groups?: IGroup[]; // 关联的群（如果是群消息）
  image: string; // 图片
  intervalTime: number; // 间隔时间
  isRealTime: boolean; // 是否实时发送
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
    isRealTime: {
      type: Boolean,
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
