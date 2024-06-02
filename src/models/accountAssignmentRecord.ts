import mongoose, { Document } from 'mongoose';
import { IAccountLibrary } from './accountLibrary';
import { IUser } from './user';

// TypeScript interface for AccountAssignmentRecord
export interface IAccountAssignmentRecord extends Document {
  country: string;           // Country where the account was assigned
  platform: string;          // Platform for the account usage
  storeAccount: string;      // Store account related to this assignment
  assignedTime: string;      // Time when the account was assigned
  accountLibrary: IAccountLibrary; // Reference to the account library
  user: mongoose.Schema.Types.ObjectId | IUser;  // Reference to the User model
  username?: string;
}

const accountAssignmentRecordSchema = new mongoose.Schema<IAccountAssignmentRecord>({
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
  storeAccount: {
    type: String,
    required: true,
    trim: true
  },
  assignedTime: {
    type: String,
    required: false,
  },
  accountLibrary: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'AccountLibrary'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'  // Assuming a User model exists
  }
}, { timestamps: true });

// Mongoose model for AccountAssignmentRecord
const AccountAssignmentRecord = mongoose.model<IAccountAssignmentRecord>('AccountAssignmentRecord', accountAssignmentRecordSchema);

export default AccountAssignmentRecord;