// models/Ticket.ts
import mongoose, { Document, Model } from "mongoose";

export interface ITicket extends Document {
  ticketId: string; // TCK-001
  description: string;
  category: string | null;
  subCategory?: string | null;
  priority: "low" | "medium" | "high";
  location?: string | null;
  photos: string[]; // saved file URLs or file paths
  completionPhotos?: string[]; // Photos uploaded when completed
  createdBy?: string | null; // Telegram username or name
  createdAt: Date;
  status: "PENDING" | "COMPLETED";
  completedBy?: string | null;
  completedAt?: Date | null;
  telegramMessageId?: number | null; // Ticket confirmation message
  originalMessageId?: number | null; // Original user message that created the ticket
  telegramChatId?: number | null;
  agencyName?: string | null; // Selected agency name
  agencyTime?: string | null; // Agency arrival time (e.g., "10:30 AM")
  agencyDate?: Date | null; // Agency arrival date
}

const TicketSchema = new mongoose.Schema<ITicket>({
  ticketId: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  category: { type: String, default: null },
  subCategory: { type: String, default: null },
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium",
  },
  location: { type: String, default: null },
  photos: { type: [String], default: [] },
completionPhotos: {
    type: [String],
    default: []  // Default to empty array
  },
  createdBy: { type: String, default: "Unknown" },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["PENDING", "COMPLETED"], default: "PENDING" },
  completedBy: { type: String, default: null },
  completedAt: { type: Date, default: null },
  telegramMessageId: { type: Number, default: null },
  originalMessageId: { type: Number, default: null },
  telegramChatId: { type: Number, default: null },
  agencyName: { type: String, default: null },
  agencyTime: { type: String, default: null },
  agencyDate: { type: Date, default: null },
});

export const Ticket: Model<ITicket> =
  mongoose.models.Ticket || mongoose.model<ITicket>("Ticket", TicketSchema);
