// models/Ticket.ts
import mongoose, { Document, Model } from "mongoose";

export interface ITicket extends Document {
  ticketId: string; // TCK-001
  description: string;
  category: string | null;
  priority: "low" | "medium" | "high";
  location?: string | null;
  photos: string[]; // saved file URLs or file paths
  createdBy?: string | null; // Telegram username or name
  createdAt: Date;
  status: "PENDING" | "COMPLETED";
  completedBy?: string | null;
  completedAt?: Date | null;
  telegramMessageId?: number | null;
  telegramChatId?: number | null;
}

const TicketSchema = new mongoose.Schema<ITicket>({
  ticketId: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  category: { type: String, default: null },
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium",
  },
  location: { type: String, default: null },
  photos: { type: [String], default: [] },
  createdBy: { type: String, default: null },
  createdAt: { type: Date, default: () => new Date() },
  status: { type: String, enum: ["PENDING", "COMPLETED"], default: "PENDING" },
  completedBy: { type: String, default: null },
  completedAt: { type: Date, default: null },
  telegramMessageId: { type: Number, default: null },
  telegramChatId: { type: Number, default: null },
});

export const Ticket: Model<ITicket> =
  mongoose.models.Ticket || mongoose.model<ITicket>("Ticket", TicketSchema);
