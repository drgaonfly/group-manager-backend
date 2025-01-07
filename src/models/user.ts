import mongoose, { Document } from 'mongoose';

export interface IUser extends Document {
  isAdmin: boolean;
  roles: any;
  email: string;
  password: string;
  name: string;
  createdAt?: Date; // Time of document creation
  updatedAt?: Date; // Time the document was last updated
  live: boolean;
  inviteCode: string;
}

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: false },
    live: {
      type: Boolean,
      default: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    roles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role', // Reference the Role model
      },
    ],
    inviteCode: {
      type: String,
    },
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
  },
  { timestamps: true },
);

const User = mongoose.model<IUser>('User', userSchema);

export default User;
