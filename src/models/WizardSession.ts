// models/WizardSession.ts
import mongoose, { Document, Model, Schema } from "mongoose";

export interface IWizardSession extends Document {
  chatId: number;
  userId: number;
  botMessageId: number;
  originalText: string;
  category: string | null;
  priority: "low" | "medium" | "high" | null;
  location: {
    building: string | null;
    floor: string | null;
    room: string | null;
  };
  currentStep: "category" | "priority" | "location_building" | "location_floor" | "location_room" | "complete";
  waitingForInput: boolean;
  inputField: "category" | "location" | null;
  customLocation: string | null;
  photos: string[];
  createdAt: Date;
}

const WizardSessionSchema = new Schema<IWizardSession>(
  {
    chatId: { type: Number, required: true },
    userId: { type: Number, required: true },
    botMessageId: { type: Number, required: true, unique: true },
    originalText: { type: String, required: true },
    category: { type: String, default: null },
    priority: { type: String, enum: ["low", "medium", "high", null], default: null },
    location: {
      building: { type: String, default: null },
      floor: { type: String, default: null },
      room: { type: String, default: null },
    },
    customLocation: { type: String, default: null },
    photos: { type: [String], default: [] },
    currentStep: {
      type: String,
      enum: ["category", "priority", "location_building", "location_floor", "location_room", "complete"],
      default: "category",
    },
    waitingForInput: { type: Boolean, default: false },
    inputField: { type: String, enum: ["category", "location", null], default: null },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

// Indexes
WizardSessionSchema.index({ botMessageId: 1 }, { unique: true });
WizardSessionSchema.index({ chatId: 1 });
WizardSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 }); // Auto-delete after 1 hour

export const WizardSession: Model<IWizardSession> =
  mongoose.models.WizardSession ||
  mongoose.model<IWizardSession>("WizardSession", WizardSessionSchema);
