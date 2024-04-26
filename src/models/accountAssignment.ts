import mongoose, { Document } from 'mongoose';
import { IAccountLibrary } from './accountLibrary';

// TypeScript interface for AccountAssignment
export interface IAccountAssignment extends Document {
  country: string;           // Country where the accounts are assigned
  platform: string;          // Platform for the account usage
  numberOfAccounts: number;  // Number of accounts assigned
  assignedTime: string;      // Time when the accounts were assigned
  accountLibraries: IAccountLibrary[]; // References to multiple account libraries
  storeAccount: string;      // 店铺账号
  user: mongoose.Schema.Types.ObjectId;  // Reference to the User model
}

const accountAssignmentSchema = new mongoose.Schema<IAccountAssignment>({
  country: {
    type: String,
    required: true,
    trim: true
  },
  platform: {
    type: String,
    required: true,
    trim: true
  },
  numberOfAccounts: {
    type: Number,
    required: true
  },
  assignedTime: {
    type: String,
    required: false,
  },
  storeAccount: {
    type: String,
    required: true,
    trim: true
  },
  accountLibraries: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountLibrary'
  }],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'  // Assuming a User model exists
  }
}, { timestamps: true });

// Mongoose model for AccountLibrary
const AccountAssignment = mongoose.model<IAccountAssignment>('AccountAssignment', accountAssignmentSchema);

export default AccountAssignment;