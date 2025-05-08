import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IUser } from './user';
import { IBotUserMessage } from './botUserMessage';

export interface IbotUser extends Document {
  id: string;
  bot: mongoose.Schema.Types.ObjectId | IBot;
  user: mongoose.Schema.Types.ObjectId | IUser;
  userName: string;
  firstName: string;
  lastName: string;
  messages: mongoose.Types.ObjectId[] | IBotUserMessage[];
  fee_rate: number;
  exchange_rate: number;
}

const botUserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    firstName: { type: String, required: false },
    lastName: { type: String, required: false },
    bot: { type: mongoose.Schema.Types.ObjectId, ref: 'Bot', required: true },
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BotUserMessage' }],
    exchange_rate: {
      type: Number,
      default: 1,
    },
    fee_rate: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

botUserSchema.index({ id: 1, bot: 1 }, { unique: true });

const BotUser = mongoose.model<IbotUser>('BotUser', botUserSchema);

export default BotUser;
