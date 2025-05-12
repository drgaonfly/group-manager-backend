import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IBotUserMessage } from './botUserMessage';

export interface IBotUser extends Document {
  id: string;
  bots: mongoose.Schema.Types.ObjectId[] | IBot[];
  userName: string;
  firstName: string;
  lastName: string;
  messages: mongoose.Types.ObjectId[] | IBotUserMessage[];
}

const botUserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    userName: { type: String, required: false },
    firstName: { type: String, required: false },
    lastName: { type: String, required: false },
    bots: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bot' }],
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BotUserMessage' }],
  },
  { timestamps: true },
);

botUserSchema.index({ id: 1, bot: 1 }, { unique: true });

const BotUser = mongoose.model<IBotUser>('BotUser', botUserSchema);

export default BotUser;
