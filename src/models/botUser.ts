import mongoose, { Document } from 'mongoose';

export interface IbotUser extends Document {
  userId: string;
  userName: string;
  firstName: string;
  lastName: string;
  bot: string;
}

const botUserSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    userName: { type: String, required: false }, // 设置默认值
    firstName: { type: String, required: false }, // 设置默认值
    lastName: { type: String, required: false }, // 设置默认值
    bot: { type: String, required: true },
  },
  { timestamps: true },
);

botUserSchema.index({ userId: 1, bot: 1 }, { unique: true });

const BotUser = mongoose.model<IbotUser>('botUser', botUserSchema);

export default BotUser;
