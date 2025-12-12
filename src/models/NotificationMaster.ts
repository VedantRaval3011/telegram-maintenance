// models/NotificationMaster.ts
import mongoose, { Document, Model, Schema } from "mongoose";

export interface INotificationMaster extends Document {
  // Type of notification rule
  type: "user" | "agency";

  // User routing (for user notifications)
  userId?: mongoose.Types.ObjectId; // Reference to User model
  subCategoryIds?: mongoose.Types.ObjectId[]; // SubCategories this rule applies to

  // Agency routing (for agency notifications)
  agencyId?: mongoose.Types.ObjectId; // Reference to Agency model

  // Timing configuration
  notifyBeforeDays?: number; // For agency visit reminders (e.g., 1 = notify 1 day before)
  reminderAfterHours?: number; // For user pending reminders (e.g., 12 hours)
  maxReminders?: number; // Maximum reminder count (default: 3)

  // WhatsApp configuration
  whatsappTemplateId?: string; // WhatsApp template name/ID
  webhookCallbackUrl?: string; // Optional custom callback URL

  // Status
  active: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const NotificationMasterSchema = new Schema<INotificationMaster>(
  {
    type: {
      type: String,
      enum: ["user", "agency"],
      required: true,
    },

    // User routing
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    subCategoryIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "SubCategory",
      },
    ],

    // Agency routing
    agencyId: {
      type: Schema.Types.ObjectId,
      ref: "Agency",
      default: null,
    },

    // Timing configuration
    notifyBeforeDays: {
      type: Number,
      default: 1, // Default: notify 1 day before agency visit
    },
    reminderAfterHours: {
      type: Number,
      default: 12, // Default: remind after 12 hours
    },
    maxReminders: {
      type: Number,
      default: 3, // Default: max 3 reminders
    },

    // WhatsApp configuration
    whatsappTemplateId: {
      type: String,
      default: null,
    },
    webhookCallbackUrl: {
      type: String,
      default: null,
    },

    // Status
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Indexes for performance
NotificationMasterSchema.index({ type: 1, active: 1 });
NotificationMasterSchema.index({ userId: 1 });
NotificationMasterSchema.index({ agencyId: 1 });
NotificationMasterSchema.index({ subCategoryIds: 1 });

export const NotificationMaster: Model<INotificationMaster> =
  mongoose.models.NotificationMaster ||
  mongoose.model<INotificationMaster>("NotificationMaster", NotificationMasterSchema);
