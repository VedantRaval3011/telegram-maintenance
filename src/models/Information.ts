// models/Information.ts
import mongoose, { Document, Model } from "mongoose";

export interface IInformation extends Document {
  content: string;
  createdBy: string; // Telegram username or name
  createdAt: Date;
  type: "general" | "audit"; // Classification type
  telegramMessageId?: number | null; // Original message that contained the info
  telegramChatId?: number | null;
  photos?: string[];
  videos?: string[];
  documents?: string[];
}

const InformationSchema = new mongoose.Schema<IInformation>({
  content: { type: String, required: true },
  createdBy: { type: String, default: "Unknown" },
  createdAt: { type: Date, default: Date.now },
  type: { type: String, enum: ["general", "audit"], default: "general" },
  telegramMessageId: { type: Number, default: null },
  telegramChatId: { type: Number, default: null },
  photos: { type: [String], default: [] },
  videos: { type: [String], default: [] },
  documents: { type: [String], default: [] },
});

// Add text index for search functionality
InformationSchema.index({ content: "text", createdBy: "text" });

export const Information: Model<IInformation> =
  mongoose.models.Information || mongoose.model<IInformation>("Information", InformationSchema);
