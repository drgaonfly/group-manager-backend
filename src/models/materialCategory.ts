import mongoose, { Document } from 'mongoose';


export interface IMaterialCategory extends Document {
  name: string;
  image: string;
  parent: IMaterialCategory;
  createdAt?: Date;
  updatedAt?: Date;
}

const menuSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialCategory' },
}, { timestamps: true });

const MaterialCategory = mongoose.model<IMaterialCategory>('Menu', menuSchema);

export default MaterialCategory;
