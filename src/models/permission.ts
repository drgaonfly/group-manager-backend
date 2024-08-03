import mongoose, { Document } from 'mongoose';
import { IPermissionGroup } from './permission-group';


export interface IPermission extends Document {
  name: string;
  path: string;
  action: string;
  permissionGroup: IPermissionGroup;
  createdAt?: Date;
  updatedAt?: Date;
}

const permissionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  path: { type: String, required: true },
  action: { type: String, required: true },
  permissionGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'PermissionGroup', required: true },
}, { timestamps: true });

const Permission = mongoose.model<IPermission>('Permission', permissionSchema);

export default Permission;
