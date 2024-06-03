import mongoose, { Document } from 'mongoose';
import { IAccountAssignmentRecord } from './accountAssignmentRecord';

export interface IAccountLibrary extends Document {
  country: string;     // Country associated with the account
  platform: string;    // Platform where the account is used
  accountNumber: string; // Unique account identifier
  loginAccount: string;  // Serial number of the account
  loginPassword: string;  // Store account associated with this account
  createdAt?: Date;    // Time of document creation
  updatedAt?: Date;    // Time the document was last updated
  assignedTime?: string;
  user: mongoose.Schema.Types.ObjectId;
  storeAccount?: string;
  isAbnormal: boolean; // 是否异常
  accountAssignmentRecords: Partial<IAccountAssignmentRecord>[]
}

// Mongoose schema definition for AccountLibrary
const accountLibrarySchema = new mongoose.Schema<IAccountLibrary>({
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
  accountNumber: {
    type: String,
    required: false,
    trim: true
  },
  loginAccount: {
    type: String,
    required: false,
    trim: true
  },
  loginPassword: {
    type: String,
    required: true,
    trim: true
  },
  isAbnormal: {
    type: Boolean,
    default: false,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'  // Assuming a User model exists
  }
}, { timestamps: true });

// Mongoose model for AccountLibrary
const AccountLibrary = mongoose.model<IAccountLibrary>('AccountLibrary', accountLibrarySchema);

export default AccountLibrary;