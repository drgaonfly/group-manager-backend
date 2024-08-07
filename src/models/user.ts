import mongoose, { Document } from 'mongoose';

export interface IUser extends Document {
  [x: string]: any;
  roles: any;
  email: string;
  password: string;
  phone: string;
  name: string;
  live: boolean;
  createdAt?: Date; // Time of document creation
  updatedAt?: Date; // Time the document was last updated

}

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: false },
  name: { type: String, required: true, unique: true }, // Add unique index to name
  live: {
    type: Boolean,
    default: true,
  },
  roles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role' // Reference the Role model
  }],
}, { timestamps: true });

const User = mongoose.model<IUser>('User', userSchema);

export default User;
