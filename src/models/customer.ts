import mongoose, { Document, Schema } from 'mongoose';
import { IBot } from './bot';

export interface ICustomer extends Document {
  userId: number; // 用户ID
  bot: IBot | string; // 关联的机器人
  username: string; // 用户名
  firstName: string; // 名字
  lastName: string; // 姓氏
  languageCode: string; // 语言代码
  balance: number; // 余额
  createdAt?: Date; // 创建时间
  updatedAt?: Date; // 更新时间
  isOnline: boolean; // 是否在线
}

const customerSchema = new Schema<ICustomer>(
  {
    isOnline: { type: Boolean, required: true, default: false },
    userId: {
      type: Number,
      required: true,
      comment: '用户ID',
    },
    bot: {
      type: Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
      comment: '关联的机器人',
    },
    username: {
      type: String,
      required: false,
      comment: '用户名',
    },
    firstName: {
      type: String,
      required: false,
      comment: '名字',
    },
    lastName: {
      type: String,
      required: false,
      comment: '姓氏',
    },
    languageCode: {
      type: String,
      required: false,
      comment: '语言代码',
    },
    balance: {
      type: Number,
      default: 0, // 默认余额为0
      required: true,
      comment: '用户余额',
    },
  },
  { timestamps: true },
);

const Customer = mongoose.model<ICustomer>('Customer', customerSchema);

export default Customer;
