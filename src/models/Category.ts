import mongoose, { Document, Model, Schema, Types } from "mongoose";

// Pre-register Agency model dependency
import "@/models/AgencyMaster";

export interface ICategory extends Document {
  name: string;          
  displayName: string;   
  keywords: string[];    
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  agencies: Types.ObjectId[];  // Multiple agencies can be associated with a category
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
    agencies: [{ type: Schema.Types.ObjectId, ref: "Agency", default: [] }],   

    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Index for name is already created by 'unique: true' in schema definition
CategorySchema.index({ isActive: 1 });
CategorySchema.index({ priority: 1 });

export const Category: Model<ICategory> =
  mongoose.models.Category ||
  mongoose.model<ICategory>("Category", CategorySchema);
