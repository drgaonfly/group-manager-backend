import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IUser } from './user';
import { IBotUserMessage } from './botUserMessage';

export interface IbotUser extends Document {
  userName: string;
  firstName: string;
  lastName: string;
  bot: mongoose.Schema.Types.ObjectId | IBot;
  user: mongoose.Schema.Types.ObjectId | IUser;
  messages: mongoose.Types.ObjectId[] | IBotUserMessage[];
}

const botUserSchema = new mongoose.Schema(
  {
    userName: { type: String, required: true },
    firstName: { type: String, required: false },
    lastName: { type: String, required: false },
    bot: { type: mongoose.Schema.Types.ObjectId, ref: 'Bot', required: true },
    id: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BotUserMessage' }],
  },
  { timestamps: true },
);

botUserSchema.index({ id: 1, bot: 1 }, { unique: true });

const BotUser = mongoose.model<IbotUser>('BotUser', botUserSchema);

export default BotUser;
