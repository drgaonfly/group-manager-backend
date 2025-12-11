import mongoose, { Document } from 'mongoose';
import { IBotUser } from './botUser';
import { IBot } from './bot';
import { IGroup } from './group';
import { IUser } from './user';

// 消息类型q1
export enum MessageType {
  TEXT = 'text',
  PHOTO = 'photo',
  VIDEO = 'video',
  VOICE = 'voice',
  DOCUMENT = 'document',
  STICKER = 'sticker',
  LOCATION = 'location',
  MENTION = 'mention',
  COMMAND = 'command',
  IMAGE = 'image',
  AUDIO = 'audio',
  FILE = 'file',
  CALLBACK_QUERY = 'callback_query', // 新增 callback_query
  OTHER = 'other',
  UNKNOWN = '未知消息类型',
}

// 存储客户发给机器人的消息和拥有者回复给客户的消息
export interface IBotMessage extends Document {
  bot: mongoose.Schema.Types.ObjectId | IBot; // 关联的机器人
  botUser?: mongoose.Schema.Types.ObjectId | IBotUser; // 发送消息的 BotUser（客户或拥有者）
  messageType: string; // 消息类型，如 text, image, command 等
  content: string; // 消息内容
  raw?: any; // 原始消息体，可选
  group?: mongoose.Schema.Types.ObjectId | IGroup; // 关联的群（如果是群消息）
  telegramMessageId?: number; // Telegram 消息 ID
  proxyUser?: mongoose.Schema.Types.ObjectId | IUser; // 代理用户
  isOwnerReply?: boolean; // 是否是拥有者回复的消息
  // direction 字段移除，始终为 toBot
}

const botMessageSchema = new mongoose.Schema(
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
    messageType: {
      type: String,
      required: true,
      enum: Object.values(MessageType),
      default: 'text',
    },
    content: {
      type: String,
      required: false,
    },
    raw: {
      type: mongoose.Schema.Types.Mixed,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: false,
    },
    telegramMessageId: {
      type: Number,
      required: false,
    },
    proxyUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    isOwnerReply: {
      type: Boolean,
      required: false,
      default: false,
    },
    // 不再存 direction 字段
  },
  {
    timestamps: true,
  },
);

const BotMessage = mongoose.model<IBotMessage>('BotMessage', botMessageSchema);

export default BotMessage;
