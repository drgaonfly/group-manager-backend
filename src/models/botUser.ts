import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IUser } from './user';
import { IBotUserMessage } from './botUserMessage';

export interface IBotUser extends Document {
  id: string;
  bot: mongoose.Schema.Types.ObjectId | IBot;
  user: mongoose.Schema.Types.ObjectId | IUser;
  userName: string;
  firstName: string;
  lastName: string;
  messages: mongoose.Types.ObjectId[] | IBotUserMessage[];
}

const botUserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: false },
    firstName: { type: String, required: false },
    lastName: { type: String, required: false },
    bot: { type: mongoose.Schema.Types.ObjectId, ref: 'Bot', required: true },
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BotUserMessage' }],
  },
  { timestamps: true },
);

botUserSchema.index({ id: 1, bot: 1 }, { unique: true });

const BotUser = mongoose.model<IBotUser>('BotUser', botUserSchema);

export default BotUser;
