import mongoose, { Document } from 'mongoose';

export interface ItelegramUser extends Document {
  // id: string;
  botId: string;
  userName: string;
  firstName: string;
  botName: string;
  botFirstName: string;
}

const telegramUserSchema = new mongoose.Schema(
  {
    // id: { type: String, required: true },
    userName: { type: String, required: true }, // Add unique index to name
    firstName: { type: String, required: true },
    botId: { type: String, required: true },
    botName: { type: String, required: true },
    botFirstName: { type: String, required: true },
  },
  { timestamps: true },
);

telegramUserSchema.index({ userName: 1, botId: 1 }, { unique: true });

const TelegramUser = mongoose.model<ItelegramUser>(
  'telegramUser',
  telegramUserSchema,
);

export default TelegramUser;
