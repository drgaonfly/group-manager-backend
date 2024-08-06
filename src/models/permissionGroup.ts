import mongoose, { Document } from 'mongoose';


export interface IPermissionGroup extends Document {
  name: string;
  parent?: IPermissionGroup;
  children?: IPermissionGroup[];
  createdAt?: Date;
  updatedAt?: Date;
}

const permissionGroupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'PermissionGroup' },
  children: { type: mongoose.Schema.Types.ObjectId, ref: 'PermissionGroup' },
}, { timestamps: true });

const PermissionGroup = mongoose.model<IPermissionGroup>('PermissionGroup', permissionGroupSchema);

export default PermissionGroup;
