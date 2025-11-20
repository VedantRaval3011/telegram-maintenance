// models/Category.ts
import mongoose, { Document, Model, Schema } from "mongoose";

export interface ICategory extends Document {
  name: string; // e.g., "electrical", "plumbing"
  displayName: string; // e.g., "Electrical", "Plumbing"
  keywords: string[]; // Keywords for auto-detection
  description?: string;
  color?: string; // Hex color for UI
  icon?: string; // Emoji or icon name
  isActive: boolean;
  priority: number; // For sorting/ordering
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true, lowercase: true },
    displayName: { type: String, required: true },
    keywords: { type: [String], default: [] },
    description: { type: String, default: null },
    color: { type: String, default: "#6B7280" }, // Default gray
    icon: { type: String, default: "📋" },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
CategorySchema.index({ name: 1 }, { unique: true });
CategorySchema.index({ isActive: 1 });
CategorySchema.index({ priority: 1 });

export const Category: Model<ICategory> =
  mongoose.models.Category ||
  mongoose.model<ICategory>("Category", CategorySchema);
