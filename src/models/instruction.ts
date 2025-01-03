import mongoose, { Document } from 'mongoose';

export interface IInstruction extends Document {
  title: string;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const instructionSchema = new mongoose.Schema(
  {
    title: { type: String, required: false },
    content: { type: String, required: false },
  },
  { timestamps: true },
);

const Instruction = mongoose.model<IInstruction>(
  'Instruction',
  instructionSchema,
);

export default Instruction;
