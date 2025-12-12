// models/NotificationLog.ts
import mongoose, { Document, Model, Schema } from "mongoose";

export interface INotificationLog extends Document {
  // References
  notificationMasterId?: mongoose.Types.ObjectId; // Rule that triggered this
  ticketId?: mongoose.Types.ObjectId; // Related ticket
  userId?: mongoose.Types.ObjectId; // User who received
  agencyId?: mongoose.Types.ObjectId; // Agency who received

  // WhatsApp tracking
  messageSid?: string; // WhatsApp message ID (wamid)
  recipientPhone: string; // Phone number sent to
  templateId?: string; // Template used
  messageContent?: string; // Actual message content

  // Notification type
  type: "first" | "reminder" | "before_visit" | "missed_visit";

  // Delivery status tracking
  deliveryStatus: "pending" | "sent" | "delivered" | "read" | "failed";
  failureReason?: string;

  // User response
  replied: boolean;
  replyContent?: string;
  replyAt?: Date;

  // Reminder tracking
  reminderCount: number; // Which reminder this is (1, 2, 3...)

  // Timestamps
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationLogSchema = new Schema<INotificationLog>(
  {
    // References
    notificationMasterId: {
      type: Schema.Types.ObjectId,
      ref: "NotificationMaster",
      default: null,
    },
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: "Ticket",
      default: null,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    agencyId: {
      type: Schema.Types.ObjectId,
      ref: "Agency",
      default: null,
    },

    // WhatsApp tracking
    messageSid: {
      type: String,
      default: null,
    },
    recipientPhone: {
      type: String,
      required: true,
    },
    templateId: {
      type: String,
      default: null,
    },
    messageContent: {
      type: String,
      default: null,
    },

    // Notification type
    type: {
      type: String,
      enum: ["first", "reminder", "before_visit", "missed_visit"],
      required: true,
    },

    // Delivery status tracking
    deliveryStatus: {
      type: String,
      enum: ["pending", "sent", "delivered", "read", "failed"],
      default: "pending",
    },
    failureReason: {
      type: String,
      default: null,
    },

    // User response
    replied: {
      type: Boolean,
      default: false,
    },
    replyContent: {
      type: String,
      default: null,
    },
    replyAt: {
      type: Date,
      default: null,
    },

    // Reminder tracking
    reminderCount: {
      type: Number,
      default: 1,
    },

    // Timestamps
    sentAt: {
      type: Date,
      default: Date.now,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for performance
NotificationLogSchema.index({ ticketId: 1 });
NotificationLogSchema.index({ userId: 1 });
NotificationLogSchema.index({ agencyId: 1 });
NotificationLogSchema.index({ messageSid: 1 });
NotificationLogSchema.index({ deliveryStatus: 1 });
NotificationLogSchema.index({ type: 1, sentAt: -1 });
NotificationLogSchema.index({ notificationMasterId: 1, ticketId: 1, type: 1 });

export const NotificationLog: Model<INotificationLog> =
  mongoose.models.NotificationLog ||
  mongoose.model<INotificationLog>("NotificationLog", NotificationLogSchema);
