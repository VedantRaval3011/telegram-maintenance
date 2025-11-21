import mongoose, { Document, Model, Schema } from "mongoose";

export interface IWorkflowRule extends Document {
  categoryId: mongoose.Types.ObjectId;

  // Main logic
  hasSubcategories: boolean; // machine, paint → true
  requiresLocation: boolean; // most categories → true
  requiresSourceLocation: boolean; // transfer → true
  requiresTargetLocation: boolean; // transfer → true

  requiresAgency: boolean; // paint, civil → true
  requiresAgencyDate: boolean; // if requiresAgency === true

  // Additional dynamic fields
  additionalFields: {
    key: string;
    label: string;
    type: "text" | "number" | "date" | "photo" | "select";
    options?: string[];
  }[];

  createdAt: Date;
  updatedAt: Date;
}

const WorkflowRuleSchema = new Schema<IWorkflowRule>(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },

    hasSubcategories: { type: Boolean, default: false },

    requiresLocation: { type: Boolean, default: false },
    requiresSourceLocation: { type: Boolean, default: false },
    requiresTargetLocation: { type: Boolean, default: false },

    requiresAgency: { type: Boolean, default: false },
    requiresAgencyDate: { type: Boolean, default: false },

    additionalFields: [
      {
        key: { type: String, required: true },
        label: { type: String, required: true },
        type: { type: String, required: true },
        options: { type: [String], default: [] },
      },
    ],
  },
  { timestamps: true }
);

WorkflowRuleSchema.index({ categoryId: 1 });

export const WorkflowRule: Model<IWorkflowRule> =
  mongoose.models.WorkflowRule ||
  mongoose.model<IWorkflowRule>("WorkflowRule", WorkflowRuleSchema);
