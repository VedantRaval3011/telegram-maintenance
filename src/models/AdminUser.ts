// models/AdminUser.ts
import mongoose, { Document, Model, Schema } from "mongoose";

/**
 * Available sections/permissions in the application
 */
export const APP_SECTIONS = {
  dashboard: { label: "Dashboard", path: "/dashboard" },
  building_map: { label: "Building Map", path: "/dashboard/building-map" },
  categories: { label: "Categories", path: "/masters/categories" },
  users: { label: "Users", path: "/masters/users" },
  locations: { label: "Locations", path: "/masters/locations" },
  workflows: { label: "Workflow Rules", path: "/masters/workflow-rules" },
  informations: { label: "Informations", path: "/masters/informations" },
  agencies: { label: "Agencies", path: "/masters/agencies" },
  purchase: { label: "Purchase", path: "/purchase" },
  summary: { label: "Summary", path: "/summary" },
  settings: { label: "Settings", path: "/settings" },
  admin: { label: "Super Admin", path: "/admin" },
} as const;

export type SectionKey = keyof typeof APP_SECTIONS;

export interface IAdminUser extends Document {
  username: string;
  passwordHash: string;
  displayName: string;
  email?: string;
  
  // Permissions
  isSuperAdmin: boolean; // Super admins have access to everything
  permissions: SectionKey[]; // List of sections this user can access
  
  // Location-based access control
  allowedLocationIds: mongoose.Types.ObjectId[]; // Locations this user can access (empty = all locations)
  isReadOnly: boolean; // If true, user cannot edit/delete/complete tickets
  hideTimeDetails: boolean; // If true, time information is hidden from user
  
  // Status
  isActive: boolean;
  lastLoginAt?: Date;
  
  // Tracking
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
}

const AdminUserSchema = new Schema<IAdminUser>(
  {
    username: { 
      type: String, 
      required: true, 
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 50
    },
    passwordHash: { 
      type: String, 
      required: true 
    },
    displayName: { 
      type: String, 
      required: true,
      trim: true,
      maxlength: 100
    },
    email: { 
      type: String, 
      default: null,
      lowercase: true,
      trim: true
    },
    
    isSuperAdmin: { 
      type: Boolean, 
      default: false 
    },
    permissions: [{
      type: String,
      enum: Object.keys(APP_SECTIONS)
    }],
    
    // Location-based access control
    allowedLocationIds: [{
      type: Schema.Types.ObjectId,
      ref: "Location"
    }],
    isReadOnly: {
      type: Boolean,
      default: false
    },
    hideTimeDetails: {
      type: Boolean,
      default: false
    },
    
    isActive: { 
      type: Boolean, 
      default: true 
    },
    lastLoginAt: { 
      type: Date, 
      default: null 
    },
    
    createdBy: { 
      type: Schema.Types.ObjectId, 
      ref: "AdminUser", 
      default: null 
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
AdminUserSchema.index({ username: 1 }, { unique: true });
AdminUserSchema.index({ isActive: 1 });

export const AdminUser: Model<IAdminUser> =
  mongoose.models.AdminUser || mongoose.model<IAdminUser>("AdminUser", AdminUserSchema);
