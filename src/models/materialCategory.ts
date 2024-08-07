import mongoose, { Document } from 'mongoose';


export interface IMaterialCategory extends Document {
  name: string;
  image: string;
  parent: IMaterialCategory;
  children: IMaterialCategory[];
  createdAt?: Date;
  updatedAt?: Date;
}

const materialCategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialCategory' },
  children: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialCategory' }
}, { timestamps: true });

const MaterialCategory = mongoose.model<IMaterialCategory>('MaterialCategory', materialCategorySchema);

export default MaterialCategory;
