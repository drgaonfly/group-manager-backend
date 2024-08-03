import mongoose, { Document } from 'mongoose';
import { IPermission } from './permission';

export interface IMenu extends Document {
  name: string;
  path: string;
  icon?: string;
  parent?: IMenu;
  permission: IPermission;
  createdAt?: Date;
  updatedAt?: Date;
}

const menuSchema = new mongoose.Schema({
  name: { type: String, required: true },
  path: { type: String, required: true },
  icon: { type: String },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Menu' },
  permission: { type: mongoose.Schema.Types.ObjectId, ref: 'Permission', required: true },
}, { timestamps: true });

const Menu = mongoose.model<IMenu>('Menu', menuSchema);

export default Menu;
