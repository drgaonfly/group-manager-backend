import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IBotUser } from './botUser';
import { IBotUserMessage } from './botUserMessage';

// 机器人用户消息历史接口定义
export interface IBotUserMessageHistory extends Document {
  bot: mongoose.Types.ObjectId | IBot;
  botUser: mongoose.Types.ObjectId | IBotUser;
  lastSentMessage: mongoose.Types.ObjectId | IBotUserMessage;
  sentAt: Date;
}

// 机器人用户消息历史 Schema
const botUserMessageHistorySchema = new mongoose.Schema(
  {
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
    },
    botUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      required: true,
    },
    lastSentMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUserMessage',
      required: true,
    },
    sentAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

const BotUserMessageHistory = mongoose.model<IBotUserMessageHistory>(
  'BotUserMessageHistory',
  botUserMessageHistorySchema,
);

export default BotUserMessageHistory;
