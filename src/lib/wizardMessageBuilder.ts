// lib/wizardMessageBuilder.ts
import { IWizardSession } from "@/models/WizardSession";
import { Category } from "@/models/Category";
import { SubCategory } from "@/models/SubCategoryMaster";
import { Location } from "@/models/Location";
import { WorkflowRule } from "@/models/WorkflowRuleMaster";
import {
  getRequiredFields,
  getFieldStatus,
  getFieldDisplayValue,
  canSubmit,
  WizardField,
  WizardFieldDefinition,
  areDependenciesMet,
  isFieldComplete,
} from "./wizardStateResolver";

/**
 * Telegram inline keyboard button
 */
interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

/**
 * Result of building the unified wizard message
 */
export interface UnifiedWizardMessage {
  messageText: string;
  keyboard: InlineKeyboardButton[][];
}

/**
 * Build keyboard for a specific field
 */
async function buildFieldKeyboard(
  session: IWizardSession,
  field: WizardField,
  botMessageId: number
): Promise<InlineKeyboardButton[][]> {
  const keyboard: InlineKeyboardButton[][] = [];

  switch (field) {
    case "category": {
      const cats = await Category.find({ isActive: true }).sort({ priority: -1, name: 1 }).lean();
      // Build in two-column rows
      for (let i = 0; i < cats.length; i += 2) {
        const left = cats[i];
        const right = cats[i + 1];
        const row: InlineKeyboardButton[] = [];
        row.push({
          text: `${left.icon || "📋"} ${left.displayName}`,
          callback_data: `select_${botMessageId}_category_${left._id}`,
        });
        if (right) {
          row.push({
            text: `${right.icon || "📋"} ${right.displayName}`,
            callback_data: `select_${botMessageId}_category_${right._id}`,
          });
        }
        keyboard.push(row);
      }
      break;
    }

    case "priority": {
      keyboard.push([
        { text: "🔴 High", callback_data: `select_${botMessageId}_priority_high` },
        { text: "🟡 Medium", callback_data: `select_${botMessageId}_priority_medium` },
        { text: "🟢 Low", callback_data: `select_${botMessageId}_priority_low` },
      ]);
      break;
    }

    case "subcategory": {
      if (!session.category) break;
      const subs = await SubCategory.find({ categoryId: session.category, isActive: true })
        .sort({ name: 1 })
        .lean();
      for (let i = 0; i < subs.length; i += 2) {
        const left = subs[i];
        const right = subs[i + 1];
        const row: InlineKeyboardButton[] = [];
        row.push({
          text: `${left.icon || ""} ${left.name}`,
          callback_data: `select_${botMessageId}_subcategory_${left._id}`,
        });
        if (right) {
          row.push({
            text: `${right.icon || ""} ${right.name}`,
            callback_data: `select_${botMessageId}_subcategory_${right._id}`,
          });
        }
        keyboard.push(row);
      }
      break;
    }

    case "location":
    case "source_location":
    case "target_location": {
      // Get current parent for this location type
      let currentParentId: string | null = null;
      if (field === "location" && session.selectedLocationId) {
        currentParentId = session.selectedLocationId;
      } else if (field === "source_location" && session.sourceLocationPath?.length > 0) {
        currentParentId = session.sourceLocationPath[session.sourceLocationPath.length - 1].id;
      } else if (field === "target_location" && session.targetLocationPath?.length > 0) {
        currentParentId = session.targetLocationPath[session.targetLocationPath.length - 1].id;
      }

      const query: any = currentParentId ? { parentLocationId: currentParentId } : { parentLocationId: null };
      const children = await Location.find(query).sort({ name: 1 }).lean();

      for (let i = 0; i < children.length; i += 2) {
        const left = children[i];
        const right = children[i + 1];
        const row: InlineKeyboardButton[] = [];
        row.push({
          text: left.name,
          callback_data: `select_${botMessageId}_${field}_${left._id}`,
        });
        if (right) {
          row.push({
            text: right.name,
            callback_data: `select_${botMessageId}_${field}_${right._id}`,
          });
        }
        keyboard.push(row);
      }

      // Add back button if we're not at root
      if (currentParentId) {
        keyboard.push([
          {
            text: "⬅️ Back",
            callback_data: `select_${botMessageId}_${field}_back`,
          },
        ]);
      }
      break;
    }

    case "agency": {
      keyboard.push([
        { text: "✅ Yes (Agency will do)", callback_data: `select_${botMessageId}_agency_yes` },
      ]);
      keyboard.push([
        { text: "❌ No (We will do)", callback_data: `select_${botMessageId}_agency_no` },
      ]);
      break;
    }

    case "agency_date": {
      // For date input, we'll need text input - show instruction
      keyboard.push([
        {
          text: "📅 Type date in chat (YYYY-MM-DD)",
          callback_data: `select_${botMessageId}_agency_date_prompt`,
        },
      ]);
      break;
    }

    default: {
      // Additional fields
      if (field.startsWith("field_")) {
        const fieldKey = field.substring(6);
        const rule = await WorkflowRule.findOne({ categoryId: session.category }).lean();
        const fieldDef = rule?.additionalFields?.find((f) => f.key === fieldKey);

        if (fieldDef) {
          if (fieldDef.type === "select" && fieldDef.options && fieldDef.options.length > 0) {
            // Build select options
            for (let i = 0; i < fieldDef.options.length; i += 2) {
              const left = fieldDef.options[i];
              const right = fieldDef.options[i + 1];
              const row: InlineKeyboardButton[] = [];
              row.push({
                text: left,
                callback_data: `select_${botMessageId}_${field}_${left}`,
              });
              if (right) {
                row.push({
                  text: right,
                  callback_data: `select_${botMessageId}_${field}_${right}`,
                });
              }
              keyboard.push(row);
            }
          } else {
            // Text/number/date/photo - need text input
            keyboard.push([
              {
                text: `✍️ Type ${fieldDef.label} in chat`,
                callback_data: `select_${botMessageId}_${field}_prompt`,
              },
            ]);
          }
        }
      }
      break;
    }
  }

  return keyboard;
}

/**
 * Build the unified wizard message showing all fields at once
 */
export async function buildUnifiedWizardMessage(session: IWizardSession): Promise<UnifiedWizardMessage> {
  const requiredFields = await getRequiredFields(session.category);
  const submitAllowed = await canSubmit(session);

  // Group fields by status
  const completedFields: WizardFieldDefinition[] = [];
  const activeField: WizardFieldDefinition | null = null;
  const pendingFields: WizardFieldDefinition[] = [];

  let currentActiveField: WizardFieldDefinition | null = null;

  for (const fieldDef of requiredFields) {
    const status = await getFieldStatus(session, fieldDef.key);
    
    if (status === "complete") {
      completedFields.push(fieldDef);
    } else if (status === "active") {
      currentActiveField = fieldDef;
    } else if (status === "pending" && areDependenciesMet(session, fieldDef)) {
      pendingFields.push(fieldDef);
    }
  }

  // Build message text
  const lines: string[] = [];
  lines.push("🛠 <b>Ticket Wizard</b>");
  lines.push(`📝 Issue: ${session.originalText}`);
  lines.push("");

  // Completed fields section
  if (completedFields.length > 0) {
    lines.push("<b>✅ Completed:</b>");
    for (const fieldDef of completedFields) {
      const value = getFieldDisplayValue(session, fieldDef.key);
      lines.push(`  • <b>${fieldDef.label}:</b> ${value}`);
    }
    lines.push("");
  }

  // Active field section (expanded)
  if (currentActiveField) {
    lines.push(`<b>👉 ${currentActiveField.label}:</b>`);
    lines.push("  Select from options below ⬇️");
    lines.push("");
  }

  // Pending fields section
  if (pendingFields.length > 0) {
    lines.push("<b>⏹️ Remaining:</b>");
    for (const fieldDef of pendingFields) {
      lines.push(`  • ${fieldDef.label}`);
    }
    lines.push("");
  }

  // Photos
  const photoCount = session.photos?.length || 0;
  if (photoCount > 0) {
    lines.push(`📸 <b>Photos:</b> ${photoCount} attached`);
  } else {
    lines.push("📸 <b>Photos:</b> None (send image to attach)");
  }

  const messageText = lines.join("\n");

  // Build keyboard
  const keyboard: InlineKeyboardButton[][] = [];

  // Jump buttons for completed fields (allow changing)
  if (completedFields.length > 0) {
    const jumpRow: InlineKeyboardButton[] = [];
    for (const fieldDef of completedFields) {
      if (jumpRow.length >= 2) {
        keyboard.push([...jumpRow]);
        jumpRow.length = 0;
      }
      jumpRow.push({
        text: `✏️ ${fieldDef.label}`,
        callback_data: `jump_${session.botMessageId}_${fieldDef.key}`,
      });
    }
    if (jumpRow.length > 0) {
      keyboard.push(jumpRow);
    }
  }

  // Active field options (expanded)
  if (currentActiveField) {
    const fieldKeyboard = await buildFieldKeyboard(session, currentActiveField.key, session.botMessageId);
    keyboard.push(...fieldKeyboard);
  }

  // Submit button (only if all complete)
  if (submitAllowed) {
    keyboard.push([
      {
        text: "✅ Create Ticket",
        callback_data: `submit_${session.botMessageId}`,
      },
    ]);
  }

  return {
    messageText,
    keyboard,
  };
}
