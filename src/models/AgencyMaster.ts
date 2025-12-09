import mongoose, { Document, Model, Schema, Types } from "mongoose";

// Pre-register Category model dependency
import "@/models/Category";

export interface IAgency extends Document {
  name: string;
  phone: string;
  email: string;
  notes: string;
  categories: Types.ObjectId[];  // Categories this agency is linked to
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AgencySchema = new Schema<IAgency>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    categories: [{ type: Schema.Types.ObjectId, ref: "Category", default: [] }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Index for quick lookups
AgencySchema.index({ name: 1 });
AgencySchema.index({ isActive: 1 });

export const Agency: Model<IAgency> =
  mongoose.models.Agency || mongoose.model<IAgency>("Agency", AgencySchema);
