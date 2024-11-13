import mongoose, { Document } from 'mongoose';

export interface IBot extends Document {
  botId: string; // 机器人id
  botToken: string; // 机器人token
  botUsername: string; // 机器人username
  botName: string; // 机器人名称
  telegramId: string; // telegram ID
  telegramUsername: string; // telegram username
  createdAt?: Date;
  updatedAt?: Date;
}

const botSchema = new mongoose.Schema(
  {
    botId: {
      type: String,
      required: false,
      comment: '机器人id',
    },
    botToken: {
      type: String,
      required: true,
      comment: '机器人token',
    },
    botUsername: {
      type: String,
      required: false,
      comment: '机器人username',
    },
    botName: {
      type: String,
      required: false,
      comment: '机器人名称',
    },
    telegramId: {
      type: String,
      required: false,
      comment: 'telegram ID',
    },
    telegramUsername: {
      type: String,
      required: false,
      comment: 'telegram username',
    },
  },
  { timestamps: true },
);

const Bot = mongoose.model<IBot>('Bot', botSchema);

export default Bot;
