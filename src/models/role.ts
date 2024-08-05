import mongoose, { Document } from 'mongoose';
import { IPermission } from './permission';
import { IDataPermission } from './dataPermission';

export interface IRole extends Document {
  name: string;
  permissions: IPermission[];
  createdAt: Date;
  updatedAt: Date;
  dataPermissions: IDataPermission[];
}

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Permission' }],
  dataPermissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DataPermission' }],
}, { timestamps: true });

const Role = mongoose.model<IRole>('Role', roleSchema);

export default Role;
