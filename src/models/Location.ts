import mongoose, { Document, Model, Schema } from "mongoose";

export interface ILocation extends Document {
  name: string;              // Example: "136", "Nutra", "G1", "L2", "Room 304"
  type?: string;             // Fully dynamic: "building", "glevel", "l1", "special", "other", etc.
  code?: string | null;      
  description?: string | null;

  latitude?: number | null;
  longitude?: number | null;

  parentLocationId?: mongoose.Types.ObjectId | null;

  capacity?: number | null;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<ILocation>(
  {
    name: { type: String, required: true },

    /**
     * DYNAMIC TYPE
     * - remove enum
     * - admin can create anything:
     *   "building", "floor", "wing", "area", "glevel", "special"
     * - or can leave it null
     */
    type: { type: String, default: null },

    code: { type: String, default: null },
    description: { type: String, default: null },

    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },

    /**
     * Hierarchical parent reference
     * If null → top-level Location
     */
    parentLocationId: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      default: null,
    },

    capacity: { type: Number, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes for performance
LocationSchema.index({ type: 1 });
LocationSchema.index({ name: 1 });
LocationSchema.index({ code: 1 }, { sparse: true });
LocationSchema.index({ parentLocationId: 1 });
LocationSchema.index({ isActive: 1 });

export const Location: Model<ILocation> =
  mongoose.models.Location ||
  mongoose.model<ILocation>("Location", LocationSchema);
