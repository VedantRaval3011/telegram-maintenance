import mongoose, { Document, Model, Schema } from "mongoose";

export interface IWizardLocationNode {
  id: string;     
  name: string;   
}

export interface IWizardSession extends Document {
  chatId: number;
  userId: number;
  botMessageId: number;
  originalMessageId: number; // The user's original message that created the ticket
  originalText: string;

  category: string | null;
  categoryDisplay: string | null;
  subCategoryId: string | null;
  subCategoryDisplay: string | null; 

  priority: "low" | "medium" | "high" | null;

  /** Information type (for information category) */
  infoType: "general" | "audit" | null;

  /** Dynamic Location Picker */
  locationPath: IWizardLocationNode[];
  selectedLocationId: string | null;
  locationComplete: boolean;

  /** Transfer Category Support */
  sourceLocationPath: IWizardLocationNode[];
  sourceLocationComplete: boolean;

  targetLocationPath: IWizardLocationNode[];
  targetLocationComplete: boolean;

  /** Manual location override */
  customLocation: string | null;

  /** Agency Logic */
  agencyRequired: boolean | null;
  agencyName: string | null;
  agencyMonth: number | null;    // Month number (0-11)
  agencyYear: number | null;     // Year for the selected month
  agencyDate: Date | null;
  agencyDateSkipped: boolean;  // True when user selects "No Date Given"
  agencyTimeSlot: string | null;  // "first_half" or "second_half"

  /** Add or Repair Choice */
  addOrRepairChoice: "add" | "repair" | null;

  /** Editing existing ticket (null if creating new) */
  editingTicketId: string | null;

  /** Dynamic Additional Fields */
  additionalFieldValues: Record<string, any>;

  photos: string[];
  videos: string[];

  /**
   * Current step of the wizard
   * - category
   * - subcategory
   * - priority
   * - location
   * - source_location
   * - target_location
   * - agency
   * - agency_date
   * - additional_fields
   * - complete
   */
  currentStep: string;

  waitingForInput: boolean;
  inputField: string | null;

  createdAt: Date;
}

const WizardSessionSchema = new Schema<IWizardSession>(
  {
    chatId: { type: Number, required: true },
    userId: { type: Number, required: true },
    botMessageId: { type: Number, required: true, unique: true },
    originalMessageId: { type: Number, required: true },
    originalText: { type: String, required: true },

    category: { type: String, default: null },
    categoryDisplay: { type: String, default: null },
    subCategoryId: { type: String, default: null },
    subCategoryDisplay: { type: String, default: null },

    priority: { type: String, enum: ["low", "medium", "high", null], default: null },

    /** Information type (for information category) */
    infoType: { type: String, enum: ["general", "audit", null], default: null },

    /** Main dynamic location path */
    locationPath: {
      type: [
        {
          id: { type: String, required: true },
          name: { type: String, required: true },
        },
      ],
      default: [],
    },

    selectedLocationId: { type: String, default: null },
    locationComplete: { type: Boolean, default: false },

    /** Transfer — from */
    sourceLocationPath: {
      type: [
        {
          id: { type: String, required: true },
          name: { type: String, required: true },
        },
      ],
      default: [],
    },
    sourceLocationComplete: { type: Boolean, default: false },

    /** Transfer — to */
    targetLocationPath: {
      type: [
        {
          id: { type: String, required: true },
          name: { type: String, required: true },
        },
      ],
      default: [],
    },
    targetLocationComplete: { type: Boolean, default: false },

    customLocation: { type: String, default: null },

    /** Agency fields */
    agencyRequired: { type: Boolean, default: null },
    agencyName: { type: String, default: null },
    agencyMonth: { type: Number, default: null },
    agencyYear: { type: Number, default: null },
    agencyDate: { type: Date, default: null },
    agencyDateSkipped: { type: Boolean, default: false },  // True when user selects "No Date Given"
    agencyTimeSlot: { type: String, enum: ["first_half", "second_half", null], default: null },

    /** Add or Repair choice */
    addOrRepairChoice: { type: String, enum: ["add", "repair", null], default: null },

    /** Editing existing ticket (null if creating new) */
    editingTicketId: { type: String, default: null },

    /** Additional dynamic fields */
    additionalFieldValues: { type: Object, default: {} },

    photos: { type: [String], default: [] },
    videos: { type: [String], default: [] },

    /** Dynamic step system */
    currentStep: { type: String, default: "category" },

    waitingForInput: { type: Boolean, default: false },
    inputField: { type: String, default: null },

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Performance indexes
WizardSessionSchema.index({ botMessageId: 1 }); // Fast lookup during callbacks
WizardSessionSchema.index({ userId: 1, waitingForInput: 1 }); // Fast lookup for active input sessions
WizardSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 }); // Auto-cleanup after 1 hour

export const WizardSession: Model<IWizardSession> =
  mongoose.models.WizardSession ||
  mongoose.model<IWizardSession>("WizardSession", WizardSessionSchema);
