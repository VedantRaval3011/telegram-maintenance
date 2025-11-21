import mongoose, { Document, Model, Schema } from "mongoose";

export interface ICategory extends Document {
  name: string;          
  displayName: string;   
  keywords: string[];    
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true, lowercase: true },
    displayName: { type: String, required: true },
    keywords: { type: [String], default: [] },
    description: { type: String, default: null },
    color: { type: String, default: null },  
    icon: { type: String, default: "📋" },   

    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CategorySchema.index({ name: 1 }, { unique: true });
CategorySchema.index({ isActive: 1 });
CategorySchema.index({ priority: 1 });

export const Category: Model<ICategory> =
  mongoose.models.Category ||
  mongoose.model<ICategory>("Category", CategorySchema);
