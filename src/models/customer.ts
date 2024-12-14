import mongoose, { Document } from 'mongoose';

export interface ICustomer extends Document {
  _id: string;
  username: string;
  email: string;
  phoneNumber: string;
  password: string;
  phoneCode: string;
  session?: string;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    phoneCode: {
      type: String,
      required: true,
      trim: true,
    },
    session: {
      type: String,
      trim: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

const Customer = mongoose.model<ICustomer>('Customer', customerSchema);

export default Customer;
