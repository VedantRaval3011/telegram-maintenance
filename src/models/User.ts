// models/User.ts
import mongoose, { Document, Model, Schema } from "mongoose";

export interface IUser extends Document {
  telegramId: number; // Unique Telegram user ID
  username?: string; // @username
  firstName?: string;
  lastName?: string;
  isBot: boolean;
  languageCode?: string;
  isPremium?: boolean;

  // Role in groups
  role?: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked";

  // Metadata
  bio?: string;
  locationId?: mongoose.Types.ObjectId; // Reference to Location

  // Tracking
  firstSeenAt: Date;
  lastSeenAt: Date;
  lastSyncedAt: Date;

  // Source tracking
  source: "webhook" | "admin_sync" | "manual";
  chatIds: number[]; // Groups where user is present
}

const UserSchema = new Schema<IUser>(
  {
    telegramId: { type: Number, required: true, unique: true },
    username: { type: String, default: null },
    firstName: { type: String, default: null },
    lastName: { type: String, default: null },
    isBot: { type: Boolean, required: true, default: false },
    languageCode: { type: String, default: null },
    isPremium: { type: Boolean, default: false },

    role: {
      type: String,
      enum: ["creator", "administrator", "member", "restricted", "left", "kicked"],
      default: "member",
    },

    bio: { type: String, default: null },
    locationId: { type: Schema.Types.ObjectId, ref: "Location", default: null },

    firstSeenAt: { type: Date, required: true, default: () => new Date() },
    lastSeenAt: { type: Date, required: true, default: () => new Date() },
    lastSyncedAt: { type: Date, required: true, default: () => new Date() },

    source: {
      type: String,
      enum: ["webhook", "admin_sync", "manual"],
      required: true,
      default: "webhook",
    },
    chatIds: { type: [Number], default: [] },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Indexes for performance
UserSchema.index({ telegramId: 1 }, { unique: true });
UserSchema.index({ username: 1 });
UserSchema.index({ lastSyncedAt: 1 });
UserSchema.index({ chatIds: 1 });

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
