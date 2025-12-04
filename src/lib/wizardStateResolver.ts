// lib/wizardStateResolver.ts
import { IWizardSession } from "@/models/WizardSession";
import { WorkflowRule, IWorkflowRule } from "@/models/WorkflowRuleMaster";

/**
 * Field types that can appear in the wizard
 */
export type WizardField =
  | "category"
  | "priority"
  | "subcategory"
  | "location"
  | "source_location"
  | "target_location"
  | "agency"
  | "agency_date"
  | `field_${string}`; // Dynamic additional fields

/**
 * Field completion status
 */
export type FieldStatus = "complete" | "active" | "pending";

/**
 * Field definition with metadata
 */
export interface WizardFieldDefinition {
  key: WizardField;
  label: string;
  required: boolean;
  dependsOn?: WizardField[]; // Fields that must be complete before this one
}

/**
 * Helper function to deduplicate location path by removing consecutive duplicates
 */
function deduplicateLocationPath(path: { id: string; name: string }[] | null | undefined): { id: string; name: string }[] {
  if (!path || path.length === 0) return [];
  
  const deduped: { id: string; name: string }[] = [];
  let lastId: string | null = null;
  
  for (const node of path) {
    if (node.id !== lastId) {
      deduped.push(node);
      lastId = node.id;
    }
  }
  
  return deduped;
}

/**
 * Get the WorkflowRule for a category
 */
async function getWorkflowRule(categoryId: string | null): Promise<any> {
  if (!categoryId) return null;
  try {
    return await WorkflowRule.findOne({ categoryId }).lean();
  } catch (err) {
    console.error("Failed to fetch WorkflowRule:", err);
    return null;
  }
}

/**
 * Get ordered list of all required fields based on WorkflowRule
 */
export async function getRequiredFields(categoryId: string | null): Promise<WizardFieldDefinition[]> {
  const fields: WizardFieldDefinition[] = [
    { key: "category", label: "Category", required: true },
    { key: "priority", label: "Priority", required: true, dependsOn: ["category"] },
  ];

  if (!categoryId) {
    return fields;
  }

  const rule = await getWorkflowRule(categoryId);
  if (!rule) {
    // Default: just require location
    fields.push({ key: "location", label: "Location", required: true, dependsOn: ["category", "priority"] });
    return fields;
  }

  // Subcategory
  if (rule.hasSubcategories) {
    fields.push({ key: "subcategory", label: "Subcategory", required: true, dependsOn: ["category", "priority"] });
  }

  // Location variants
  if (rule.requiresSourceLocation) {
    fields.push({ key: "source_location", label: "From Location", required: true, dependsOn: ["category", "priority"] });
  }
  if (rule.requiresTargetLocation) {
    fields.push({ key: "target_location", label: "To Location", required: true, dependsOn: ["category", "priority"] });
  }
  if (rule.requiresLocation && !rule.requiresSourceLocation && !rule.requiresTargetLocation) {
    fields.push({ key: "location", label: "Location", required: true, dependsOn: ["category", "priority"] });
  }

  // Agency
  if (rule.requiresAgency) {
    fields.push({ key: "agency", label: "Agency", required: true, dependsOn: ["category", "priority"] });
    if (rule.requiresAgencyDate) {
      fields.push({ key: "agency_date", label: "Agency Date", required: true, dependsOn: ["agency"] });
    }
  }

  // Additional fields
  if (rule.additionalFields && rule.additionalFields.length > 0) {
    for (const field of rule.additionalFields) {
      fields.push({
        key: `field_${field.key}` as WizardField,
        label: field.label,
        required: true,
        dependsOn: ["category", "priority"],
      });
    }
  }

  return fields;
}

/**
 * Check if a specific field is complete
 */
export function isFieldComplete(session: IWizardSession, field: WizardField): boolean {
  switch (field) {
    case "category":
      return !!session.category;
    case "priority":
      return !!session.priority;
    case "subcategory":
      return !!session.subCategoryId;
    case "location":
      return session.locationComplete || !!session.customLocation;
    case "source_location":
      return session.sourceLocationComplete;
    case "target_location":
      return session.targetLocationComplete;
    case "agency":
      return session.agencyRequired !== null && session.agencyRequired !== undefined;
    case "agency_date":
      // Only required if agency is yes
      if (session.agencyRequired === false) return true;
      return !!session.agencyDate;
    default:
      // Additional fields: field_<key>
      if (field.startsWith("field_")) {
        const key = field.substring(6); // Remove "field_" prefix
        return !!(session.additionalFieldValues && session.additionalFieldValues[key]);
      }
      return false;
  }
}

/**
 * Check if dependencies for a field are met
 */
export function areDependenciesMet(session: IWizardSession, fieldDef: WizardFieldDefinition): boolean {
  if (!fieldDef.dependsOn || fieldDef.dependsOn.length === 0) return true;
  
  for (const dep of fieldDef.dependsOn) {
    if (!isFieldComplete(session, dep)) {
      return false;
    }
  }
  
  // Special case: agency_date only required if agency is yes
  if (fieldDef.key === "agency_date" && session.agencyRequired === false) {
    return false; // Don't show agency_date if agency is No
  }
  
  return true;
}

/**
 * Get the status of a field (complete, active, or pending)
 */
export async function getFieldStatus(session: IWizardSession, field: WizardField): Promise<FieldStatus> {
  const requiredFields = await getRequiredFields(session.category);
  const fieldDef = requiredFields.find(f => f.key === field);
  
  if (!fieldDef) return "pending";
  
  // Check if complete
  if (isFieldComplete(session, field)) {
    return "complete";
  }
  
  // Check if dependencies are met
  if (!areDependenciesMet(session, fieldDef)) {
    return "pending";
  }
  
  // Check if this is the next incomplete field
  const nextField = await getNextIncompleteField(session);
  if (nextField === field) {
    return "active";
  }
  
  return "pending";
}

/**
 * Get the next incomplete field that should be active
 */
export async function getNextIncompleteField(session: IWizardSession): Promise<WizardField | null> {
  const requiredFields = await getRequiredFields(session.category);
  
  for (const fieldDef of requiredFields) {
    // Skip if already complete
    if (isFieldComplete(session, fieldDef.key)) {
      continue;
    }
    
    // Skip if dependencies not met
    if (!areDependenciesMet(session, fieldDef)) {
      continue;
    }
    
    // This is the next field to complete
    return fieldDef.key;
  }
  
  return null; // All fields complete
}

/**
 * Check if all required fields are complete and wizard can be submitted
 */
export async function canSubmit(session: IWizardSession): Promise<boolean> {
  const requiredFields = await getRequiredFields(session.category);
  
  for (const fieldDef of requiredFields) {
    // Skip fields whose dependencies aren't met (they're not actually required)
    if (!areDependenciesMet(session, fieldDef)) {
      continue;
    }
    
    if (!isFieldComplete(session, fieldDef.key)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get human-readable display value for a field
 */
export function getFieldDisplayValue(session: IWizardSession, field: WizardField): string {
  switch (field) {
    case "category":
      return (session as any).categoryDisplay || session.category || "—";
    case "priority":
      return session.priority ? session.priority.toUpperCase() : "—";
    case "subcategory":
      return (session as any).subCategoryDisplay || session.subCategoryId || "—";
    case "location":
      if (session.customLocation) return session.customLocation;
      if (session.locationPath && session.locationPath.length > 0) {
        return deduplicateLocationPath(session.locationPath).map(n => n.name).join(" > ");
      }
      return "—";
    case "source_location":
      if (session.sourceLocationPath && session.sourceLocationPath.length > 0) {
        return deduplicateLocationPath(session.sourceLocationPath).map(n => n.name).join(" > ");
      }
      return "—";
    case "target_location":
      if (session.targetLocationPath && session.targetLocationPath.length > 0) {
        return deduplicateLocationPath(session.targetLocationPath).map(n => n.name).join(" > ");
      }
      return "—";
    case "agency":
      if (session.agencyRequired === true) {
        return session.agencyName || "Yes";
      } else if (session.agencyRequired === false) {
        return "No";
      }
      return "—";
    case "agency_date":
      return session.agencyDate ? session.agencyDate.toISOString().split("T")[0] : "—";
    default:
      // Additional fields
      if (field.startsWith("field_")) {
        const key = field.substring(6);
        return session.additionalFieldValues?.[key] || "—";
      }
      return "—";
  }
}
