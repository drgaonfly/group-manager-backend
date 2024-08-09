import mongoose, { Document } from 'mongoose';

export interface IMaterialCategory extends Document {
  name: string;
  image: string;
  parent: IMaterialCategory;
  isEnalbe: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const materialCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    image: { type: String },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialCategory' },
    isEnalbe: { type: Boolean },
  },
  { timestamps: true },
);

const MaterialCategory = mongoose.model<IMaterialCategory>(
  'MaterialCategory',
  materialCategorySchema,
);

export default MaterialCategory;
