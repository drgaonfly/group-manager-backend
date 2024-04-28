import mongoose, { Document } from 'mongoose';
import { ROLES } from '../constants'; // Adjust the import path as necessary

type ROLE = typeof ROLES[keyof typeof ROLES];
export interface IPriceList {
  isLocalCurrency: boolean;
  exchangeRate: number;
  serviceFee: number;
  country: string;
  platform: string;
}
export interface IUser extends Document {
  email: string;
  password: string;
  phone: string;
  name: string;
  role: ROLE;
  live: boolean;
  createdAt?: Date; // Time of document creation
  updatedAt?: Date; // Time the document was last updated
  priceList: IPriceList[];
}

const priceListSchema = new mongoose.Schema({
  isLocalCurrency: { type: Boolean, required: true },
  exchangeRate: { type: Number, required: false },
  serviceFee: { type: Number, required: false },
  country: { type: String, required: true },
});

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: false },
  name: { type: String, required: false },
  role: {
    type: String,
    default: ROLES.Customer,
    enum: Object.values(ROLES),
  },
  live: {
    type: Boolean,
    default: true,
  },
  priceList: [priceListSchema],
}, { timestamps: true });

const User = mongoose.model<IUser>('User', userSchema);

export default User;
