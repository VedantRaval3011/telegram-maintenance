// models/Notification.ts
import mongoose, { Document, Model, Schema } from "mongoose";

/**
 * In-app notification delivered to a single dashboard user (AdminUser).
 * One document per recipient per event, so read/unread state is per-user.
 */
export type NotificationType =
  | "ticket_created"
  | "ticket_assigned"
  | "status_change"
  | "comment"
  | "priority_change"
  | "category_change"
  | "agency_change"
  | "verification"
  | "ticket_closed"
  | "ticket_deleted"
  | "reopened";

export const NOTIFICATION_TYPES: NotificationType[] = [
  "ticket_created",
  "ticket_assigned",
  "status_change",
  "comment",
  "priority_change",
  "category_change",
  "agency_change",
  "verification",
  "ticket_closed",
  "ticket_deleted",
  "reopened",
];

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId; // AdminUser recipient
  ticketId?: mongoose.Types.ObjectId | null; // Related ticket (_id)
  ticketDisplayId?: string | null; // e.g. "T7" - denormalized for instant render/navigation
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  meta?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "AdminUser",
      required: true,
    },
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: "Ticket",
      default: null,
    },
    ticketDisplayId: {
      type: String,
      default: null,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    isRead: { type: Boolean, default: false },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Recipient history feed (newest first) + unread counts
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });

export const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", NotificationSchema);
