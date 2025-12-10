import mongoose, { Document, Model, Schema, Types } from "mongoose";

// Note: Agency model is referenced by name "Agency" to avoid circular imports

export interface ISubCategory extends Document {
  categoryId: mongoose.Types.ObjectId;
  name: string;
  icon?: string | null;
  description?: string | null;
  agencies: Types.ObjectId[];  // Agencies linked to this subcategory
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubCategorySchema = new Schema<ISubCategory>(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    name: { type: String, required: true },
    icon: { type: String, default: null },
    description: { type: String, default: null },
    agencies: [{ type: Schema.Types.ObjectId, ref: "Agency", default: [] }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SubCategorySchema.index({ categoryId: 1 });
SubCategorySchema.index({ name: 1 });

export const SubCategory: Model<ISubCategory> =
  mongoose.models.SubCategory ||
  mongoose.model<ISubCategory>("SubCategory", SubCategorySchema);
