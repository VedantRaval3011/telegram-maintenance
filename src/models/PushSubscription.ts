// models/PushSubscription.ts
import mongoose, { Document, Model, Schema } from "mongoose";

/**
 * A browser/device Web Push subscription belonging to a dashboard user.
 * One document per browser (keyed by the unique push endpoint).
 */
export interface IPushSubscription extends Document {
  userId: mongoose.Types.ObjectId; // AdminUser owner
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "AdminUser",
      required: true,
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
    },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: null },
  },
  { timestamps: true }
);

PushSubscriptionSchema.index({ userId: 1 });

export const PushSubscription: Model<IPushSubscription> =
  mongoose.models.PushSubscription ||
  mongoose.model<IPushSubscription>("PushSubscription", PushSubscriptionSchema);
