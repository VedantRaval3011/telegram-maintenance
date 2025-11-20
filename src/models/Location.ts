// models/Location.ts
import mongoose, { Document, Model, Schema } from "mongoose";

export interface ILocation extends Document {
  name: string; // e.g., "room number 43", "Building A"
  type: "room" | "building" | "floor" | "area" | "other";
  code?: string; // e.g., "R43", "BLDG-A"
  description?: string;

  // Coordinates (optional)
  latitude?: number;
  longitude?: number;

  // Hierarchy
  parentLocationId?: mongoose.Types.ObjectId;

  // Metadata
  capacity?: number;
  isActive: boolean;

  // Tracking
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<ILocation>(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["room", "building", "floor", "area", "other"],
      default: "other",
    },
    code: { type: String, default: null },
    description: { type: String, default: null },

    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },

    parentLocationId: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      default: null,
    },

    capacity: { type: Number, default: null },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Indexes for performance
LocationSchema.index({ code: 1 }, { unique: true, sparse: true }); // sparse allows null values
LocationSchema.index({ name: 1 });
LocationSchema.index({ type: 1 });
LocationSchema.index({ isActive: 1 });

export const Location: Model<ILocation> =
  mongoose.models.Location ||
  mongoose.model<ILocation>("Location", LocationSchema);
