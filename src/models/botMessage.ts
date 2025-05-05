import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IbotUser } from './botUser';

export interface IBotUserMessage extends Document {
  content: string;
  type: 'sent' | 'received' | 'error';
  bot: mongoose.Schema.Types.ObjectId | IBot;
  botUser: mongoose.Schema.Types.ObjectId | IbotUser;
}

const botUserMessageSchema = new mongoose.Schema(
  {
    content: { type: String, required: true },
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
    botUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotUser',
      required: true,
    },
  },
  { timestamps: true },
);

const BotUserMessage = mongoose.model<IBotUserMessage>(
  'BotUserMessage',
  botUserMessageSchema,
);

export default BotUserMessage;
