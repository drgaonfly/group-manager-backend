import mongoose, { Document, Schema } from 'mongoose';
import { IPermission } from './permission';

export interface IPermissionGroup extends Document {
  name: string;
  parent?: IPermissionGroup;
  children?: IPermissionGroup[];
  createdAt?: Date;
  updatedAt?: Date;
  permissions?: IPermission[];
}

const permissionGroupSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    parent: { type: Schema.Types.ObjectId, ref: 'PermissionGroup' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

permissionGroupSchema.virtual('permissions', {
  ref: 'Permission',
  localField: '_id',
  foreignField: 'permissionGroup',
});

permissionGroupSchema.virtual('children', {
  ref: 'PermissionGroup',
  localField: '_id',
  foreignField: 'parent',
});

const PermissionGroup = mongoose.model<IPermissionGroup>(
  'PermissionGroup',
  permissionGroupSchema,
);

export default PermissionGroup;
