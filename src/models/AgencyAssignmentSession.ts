import mongoose, { Document, Model, Schema } from "mongoose";

export interface IAgencyAssignmentSession extends Document {
  chatId: number;
  userId: number;
  botMessageId: number;
  ticketId: string; // The ticket being updated (e.g., "T-123")
  ticketObjectId: mongoose.Types.ObjectId; // MongoDB ObjectId of the ticket

  // Agency details
  agencyName: string | null;
  agencyDate: Date | null;
  agencyTimeHour: number | null;   // Selected hour (1-12)
  agencyTimeMinute: number | null; // Selected minute (0, 15, 30, 45)
  agencyTimePeriod: string | null; // "AM" or "PM"

  /**
   * Current step of the wizard
   * - agency
   * - date
   * - hour
   * - minute
   * - period
   */
  currentStep: string;

  createdAt: Date;
}

const AgencyAssignmentSessionSchema = new Schema<IAgencyAssignmentSession>(
  {
    chatId: { type: Number, required: true },
    userId: { type: Number, required: true },
    botMessageId: { type: Number, required: true, unique: true },
    ticketId: { type: String, required: true },
    ticketObjectId: { type: Schema.Types.ObjectId, ref: "Ticket", required: true },

    agencyName: { type: String, default: null },
    agencyDate: { type: Date, default: null },
    agencyTimeHour: { type: Number, default: null },
    agencyTimeMinute: { type: Number, default: null },
    agencyTimePeriod: { type: String, default: null },

    currentStep: { type: String, default: "agency" },

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Performance indexes
AgencyAssignmentSessionSchema.index({ botMessageId: 1 });
AgencyAssignmentSessionSchema.index({ userId: 1 });
AgencyAssignmentSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 }); // Auto-cleanup after 1 hour

export const AgencyAssignmentSession: Model<IAgencyAssignmentSession> =
  mongoose.models.AgencyAssignmentSession ||
  mongoose.model<IAgencyAssignmentSession>("AgencyAssignmentSession", AgencyAssignmentSessionSchema);
