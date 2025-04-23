import mongoose, { Document } from 'mongoose';
import { IUser } from './user';

export interface IloginHistory extends Document {
  user: mongoose.Schema.Types.ObjectId | IUser;
  loginAt: Date;
  loginIp: string;
}

const loginHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    }, // 用户ID
    loginAt: { type: Date },
    loginIp: { type: String },
  },
  { timestamps: true },
);

const LoginHistory = mongoose.model<IloginHistory>(
  'LoginHistory',
  loginHistorySchema,
);

export default LoginHistory;
