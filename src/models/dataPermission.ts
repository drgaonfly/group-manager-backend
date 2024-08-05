import mongoose, { Document } from 'mongoose';


export interface IDataPermission extends Document {
  name: string;
  path: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const dataPermissionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  path: { type: String, required: true },
}, { timestamps: true });

const DataPermission = mongoose.model<IDataPermission>('DataPermission', dataPermissionSchema);

export default DataPermission;
