import mongoose, { Document } from 'mongoose';
import { IBotUser } from './botUser';
import { IBot } from './bot';
import { IUser } from './user';

// 积分继承（原 Bot和User的关系表）接口定义
export interface ISuccess extends Document {
  bot: mongoose.Types.ObjectId | IBot;
  proxy: mongoose.Types.ObjectId | IUser;
  botUser: mongoose.Types.ObjectId | IBotUser;
  code: string;
}

// Success Schema
const successSchema = new mongoose.Schema(
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
    botUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      required: false,
    },
    code: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const Success = mongoose.model<ISuccess>('Success', successSchema);

export default Success;
