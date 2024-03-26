import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  country: string;
  platform: string;
  file: string; // Assuming this might be a URL or file path
  user: Schema.Types.ObjectId; // Reference to a User model
  quantity: number;
  store: string; // Assuming the store name or ID as a simple string; adjust if this is a reference
  orderNumber: string;
  amount: number;
  buyerAccount: string; // Assuming a simple string; adjust if this needs to be more complex
}

const TaskSchema: Schema = new Schema({
  country: { type: String, required: true },
  platform: { type: String, required: false },
  file: { type: String, required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  quantity: { type: Number, required: false },
  store: { type: String, required: false },
  orderNumber: { type: String, required: false },
  amount: { type: Number, required: false },
  buyerAccount: { type: String, required: false },
}, { timestamps: true });

export default mongoose.model<ITask>('Task', TaskSchema);
