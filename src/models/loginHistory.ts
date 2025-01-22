import mongoose, { Document } from 'mongoose';

export interface IloginHistory extends Document {
  userId: string;
  loginAt: Date;
}

const loginHistorySchema = new mongoose.Schema(
  {
    userId: { type: String },
    loginAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const LoginHistory = mongoose.model<IloginHistory>(
  'LoginHistory',
  loginHistorySchema,
);

export default LoginHistory;
