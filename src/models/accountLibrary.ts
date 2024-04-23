import mongoose, { Document } from 'mongoose';

// TypeScript interface for AccountLibrary
export interface IAccountLibrary extends Document {
  country: string;     // Country associated with the account
  platform: string;    // Platform where the account is used
  address: string;     // Physical or mailing address associated with the account
  accountNumber: string; // Unique account identifier
  serialNumber: string;  // Serial number of the account
  storeAccount: string;  // Store account associated with this account
  createdAt?: Date;    // Time of document creation
  updatedAt?: Date;    // Time the document was last updated
  assignedTime?: string;
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
  address: {
    type: String,
    required: false,
    trim: true
  },
  accountNumber: {
    type: String,
    required: false,
    trim: true
  },
  serialNumber: {
    type: String,
    required: false,
    trim: true
  },
  storeAccount: {
    type: String,
    required: true,
    trim: true
  },
  assignedTime: {
    type: String,
    required: false
  }
}, { timestamps: true });

// Mongoose model for AccountLibrary
const AccountLibrary = mongoose.model<IAccountLibrary>('AccountLibrary', accountLibrarySchema);

export default AccountLibrary;