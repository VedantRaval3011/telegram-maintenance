// app/api/webhook/dynamic/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Ticket } from "@/models/Ticket";
import { Category } from "@/models/Category";
import { SubCategory } from "@/models/SubCategoryMaster";
import { Location } from "@/models/Location";
import { WorkflowRule } from "@/models/WorkflowRuleMaster";
import { WizardSession } from "@/models/WizardSession";
import {
  telegramSendMessage,
  editMessageText,
  answerCallbackQuery,
  downloadTelegramFile,
  telegramDeleteMessage,
} from "@/lib/telegram";
import { uploadBufferToCloudinary } from "@/lib/uploadBufferToCloudinary";
import fs from "fs";
import path from "path";

/**
 * DYNAMIC WORKFLOW-CONTROLLED TELEGRAM WEBHOOK
 * 
 * This webhook is 100% controlled by WorkflowRule configuration.
 * All fields, their order, and requirements come from the database.
 * 
 * Key Features:
 * - Single persistent message for entire wizard
 * - All fields shown at once (completed ✓, current expanded, remaining listed)
 * - Auto-advances to next required field after each selection
 * - Quick jump navigation between sections
 * - Submit only when all required fields complete
 */

// ========== PERFORMANCE OPTIMIZATION: IN-MEMORY CACHE ==========
// Cache for master data with 5-minute TTL to reduce database queries
interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const masterDataCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generic cache wrapper for database queries
 */
async function getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = masterDataCache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.data as T;
  }
  
  const data = await fetcher();
  masterDataCache.set(key, { data, expiry: Date.now() + CACHE_TTL });
  return data;
}

interface TelegramUpdate {
  update_id?: number;
  message?: any;
  edited_message?: any;
  callback_query?: any;
}

/**
 * Helper function to deduplicate location path by removing consecutive duplicates
 * This handles cases where the same location was added multiple times
 */
function deduplicateLocationPath(path: { id: string; name: string }[] | null | undefined): { id: string; name: string }[] {
  if (!path || path.length === 0) return [];
  
  // Remove consecutive duplicates (preserve order, remove repeated entries)
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

interface WizardField {
  key: string;
  label: string;
  type: "category" | "priority" | "subcategory" | "location" | "source_location" | "target_location" | "agency" | "agency_date" | "additional";
  required: boolean;
  completed: boolean;
  value?: any;
  additionalFieldKey?: string; // For additional fields
}

/**
 * Build the complete field list based on WorkflowRule
 */
async function buildFieldsFromRule(categoryId: string | null): Promise<WizardField[]> {
  const fields: WizardField[] = [];

  // Always include category and priority
  fields.push({
    key: "category",
    label: "📂 Category",
    type: "category",
    required: true,
    completed: false,
  });

  fields.push({
    key: "priority",
    label: "⚡ Priority",
    type: "priority",
    required: true,
    completed: false,
  });

  // If category selected, load workflow rule
  if (categoryId) {
    // ✅ OPTIMIZED: Cache workflow rule query
    const rule = await getCached(
      `workflow:${categoryId}`,
      () => WorkflowRule.findOne({ categoryId }).lean()
    );
    
    if (rule) {
      // Subcategory
      if (rule.hasSubcategories) {
        fields.push({
          key: "subcategory",
          label: "🧩 Subcategory",
          type: "subcategory",
          required: true,
          completed: false,
        });
      }

      // Location(s)
      if (rule.requiresLocation) {
        fields.push({
          key: "location",
          label: "📍 Location",
          type: "location",
          required: true,
          completed: false,
        });
      }

      if (rule.requiresSourceLocation) {
        fields.push({
          key: "source_location",
          label: "📍 Source Location (From)",
          type: "source_location",
          required: true,
          completed: false,
        });
      }

      if (rule.requiresTargetLocation) {
        fields.push({
          key: "target_location",
          label: "📍 Target Location (To)",
          type: "target_location",
          required: true,
          completed: false,
        });
      }

      // Agency
      if (rule.requiresAgency) {
        fields.push({
          key: "agency",
          label: "🧾 Agency/Contractor",
          type: "agency",
          required: true,
          completed: false,
        });

        if (rule.requiresAgencyDate) {
          fields.push({
            key: "agency_date",
            label: "📅 Agency Date",
            type: "agency_date",
            required: true,
            completed: false,
          });
        }
      }

      // Additional fields
      if (rule.additionalFields && rule.additionalFields.length > 0) {
        for (const addField of rule.additionalFields) {
          fields.push({
            key: `additional_${addField.key}`,
            label: `📝 ${addField.label}`,
            type: "additional",
            required: true,
            completed: false,
            additionalFieldKey: addField.key,
          });
        }
      }
    }
  }

  return fields;
}

/**
 * Mark fields as completed based on session data
 */
function updateFieldCompletion(fields: WizardField[], session: any): WizardField[] {
  return fields.map(field => {
    let completed = false;
    let value: any = undefined;

    switch (field.type) {
      case "category":
        completed = !!session.category;
        if (completed) {
          value = session.categoryDisplay || session.category;
        }
        break;
      
      case "priority":
        completed = !!session.priority;
        value = session.priority;
        break;
      
      case "subcategory":
        completed = !!session.subCategoryId;
        value = session.subCategoryDisplay || "Selected";
        break;
      
      case "location":
        completed = session.locationComplete === true;
        value = deduplicateLocationPath(session.locationPath).map((n: any) => n.name).join(" → ") || "Selected";
        break;
      
      case "source_location":
        completed = session.sourceLocationComplete === true;
        value = deduplicateLocationPath(session.sourceLocationPath).map((n: any) => n.name).join(" → ") || "Selected";
        break;
      
      case "target_location":
        completed = session.targetLocationComplete === true;
        value = deduplicateLocationPath(session.targetLocationPath).map((n: any) => n.name).join(" → ") || "Selected";
        break;
      
      case "agency":
        completed = session.agencyRequired !== undefined;
        value = session.agencyRequired ? (session.agencyName || "Yes") : "No";
        break;
      
      case "agency_date":
        completed = !!session.agencyDate;
        value = session.agencyDate ? new Date(session.agencyDate).toLocaleDateString() : undefined;
        break;
      
      case "additional":
        if (field.additionalFieldKey) {
          const fieldValue = session.additionalFieldValues?.[field.additionalFieldKey];
          completed = fieldValue !== undefined && fieldValue !== null && fieldValue !== "";
          value = fieldValue;
        }
        break;
    }

    return { ...field, completed, value };
  });
}

/**
 * Find the first incomplete required field
 */
function findCurrentField(fields: WizardField[]): WizardField | null {
  return fields.find(f => f.required && !f.completed) || null;
}

/**
 * Build keyboard for a specific field
 */
async function buildFieldKeyboard(field: WizardField, session: any, botMessageId: number): Promise<any[][]> {
  const keyboard: any[][] = [];

  switch (field.type) {
    case "category": {
      // ✅ OPTIMIZED: Cache categories query
      const categories = await getCached(
        'categories:active',
        () => Category.find({ isActive: true }).sort({ displayName: 1 }).lean()
      );
      for (const cat of categories) {
        keyboard.push([{
          text: cat.displayName,
          callback_data: `select_${botMessageId}_category_${cat._id}`
        }]);
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
      if (session.category) {
        // ✅ OPTIMIZED: Cache subcategories by categoryId
        const subcats = await getCached(
          `subcategories:${session.category}`,
          () => SubCategory.find({ categoryId: session.category, isActive: true }).sort({ name: 1 }).lean()
        );
        for (const sub of subcats) {
          keyboard.push([{
            text: sub.name,
            callback_data: `select_${botMessageId}_subcategory_${sub._id}`
          }]);
        }
      }
      break;
    }

case "location":
case "source_location":
case "target_location": {
  // ✅ FIX: Get current parent from session - use the LAST item in path as parent
  let parentId = null;
  let currentPath = [];
  
  if (field.type === "location") {
    currentPath = session.locationPath || [];
  } else if (field.type === "source_location") {
    currentPath = session.sourceLocationPath || [];
  } else {
    currentPath = session.targetLocationPath || [];
  }
  
  // ✅ CRITICAL: If location is NOT complete, use last item in path as parent
  // This allows drilling down into hierarchy
  const isComplete = field.type === "location" 
    ? session.locationComplete 
    : field.type === "source_location" 
    ? session.sourceLocationComplete 
    : session.targetLocationComplete;
  
  if (!isComplete && currentPath.length > 0) {
    parentId = currentPath[currentPath.length - 1].id;
  }

  // ✅ OPTIMIZED: Cache locations by parentId
  const cacheKey = `locations:${parentId || 'root'}`;
  const locations = await getCached(
    cacheKey,
    () => Location.find({
      parentLocationId: parentId,
      isActive: true
    }).sort({ name: 1 }).lean()
  );

  for (const loc of locations) {
    keyboard.push([{
      text: loc.name,
      callback_data: `select_${botMessageId}_${field.type}_${loc._id}`
    }]);
  }

  // Back button if we're not at root
  if (currentPath.length > 0) {
    keyboard.push([{
      text: "⬅️ Back",
      callback_data: `back_${botMessageId}_${field.type}`
    }]);
  }
  break;
}

    case "agency": {
      // ✅ OPTIMIZED: Cache workflow rule
      const rule = await getCached(
        `workflow:${session.category}`,
        () => WorkflowRule.findOne({ categoryId: session.category }).lean()
      );
      const agencies = rule?.additionalFields?.find(f => f.key === "agency")?.options || [];
      
      for (const agency of agencies) {
        keyboard.push([{
          text: agency,
          callback_data: `select_${botMessageId}_agency_${agency}`
        }]);
      }
      
      keyboard.push([{
        text: "❌ No Agency",
        callback_data: `select_${botMessageId}_agency_no`
      }]);
      break;
    }

    case "additional": {
      if (field.additionalFieldKey) {
        // ✅ OPTIMIZED: Cache workflow rule
        const rule = await getCached(
          `workflow:${session.category}`,
          () => WorkflowRule.findOne({ categoryId: session.category }).lean()
        );
        const addField = rule?.additionalFields?.find(f => f.key === field.additionalFieldKey);
        
        if (addField?.type === "select" && addField.options) {
          for (const option of addField.options) {
            keyboard.push([{
              text: option,
              callback_data: `select_${botMessageId}_additional_${field.additionalFieldKey}_${option}`
            }]);
          }
        }
        // Note: For non-select fields (text/number/date), users should type directly in chat
      }
      break;
    }
  }

  return keyboard;
}

/**
 * Format the complete wizard message
 */
async function formatWizardMessage(session: any, fields: WizardField[], currentField: WizardField | null): Promise<string> {
  let message = "🛠 <b>Ticket Wizard</b>\n";
  message += `📝 ${session.originalText || "New Ticket"}\n\n`;

  // Completed fields section
const completedFields = fields.filter(f =>
  f.completed &&
  f.key !== currentField?.key &&
  !(f.type === "location" && session.locationComplete !== true) &&
  !(f.type === "source_location" && session.sourceLocationComplete !== true) &&
  !(f.type === "target_location" && session.targetLocationComplete !== true)
);

  if (completedFields.length > 0) {
    message += "✅ <b>Completed:</b>\n";
    for (const field of completedFields) {
      message += `  ${field.label}: ${field.value}\n`;
    }
    message += "\n";
  }

  // Current field section
  if (currentField) {
    message += `🔵 <b>Current: ${currentField.label}</b>\n`;
    message += "👇 Select from options below\n\n";
  }

  // Remaining fields section
  const remainingFields = fields.filter(f => f.required && !f.completed && f.key !== currentField?.key);
  if (remainingFields.length > 0) {
    message += "⏳ <b>Remaining:</b>\n";
    for (const field of remainingFields) {
      message += `  ${field.label}\n`;
    }
    message += "\n";
  }

  // Progress indicator
  const totalRequired = fields.filter(f => f.required).length;
  const completed = fields.filter(f => f.required && f.completed).length;
  message += `📊 Progress: ${completed}/${totalRequired}\n`;

  // Photos
  if (session.photos && session.photos.length > 0) {
    message += `📸 Photos: ${session.photos.length} attached\n`;
  }

  return message;
}

/**
 * Build navigation keyboard (quick jump + submit)
 */
function buildNavigationKeyboard(fields: WizardField[], botMessageId: number): any[][] {
  const keyboard: any[][] = [];

  // Determine current active field
  const currentField = findCurrentField(fields);

  // Add jump buttons ONLY for completed fields that are NOT the current field
  const completedFields = fields.filter(
    f => f.completed && f.key !== currentField?.key
  );

  for (let i = 0; i < completedFields.length; i += 2) {
    const row: any[] = [];
    row.push({
      text: `↩️ ${completedFields[i].label.substring(0, 15)}`,
      callback_data: `jump_${botMessageId}_${completedFields[i].key}`
    });
    if (i + 1 < completedFields.length) {
      row.push({
        text: `↩️ ${completedFields[i + 1].label.substring(0, 15)}`,
        callback_data: `jump_${botMessageId}_${completedFields[i + 1].key}`
      });
    }
    keyboard.push(row);
  }

  // Submit button
  const allComplete = fields.filter(f => f.required).every(f => f.completed);
  if (allComplete) {
    keyboard.push([
      { text: "✅ Submit Ticket", callback_data: `submit_${botMessageId}` }
    ]);
  }

  // Cancel button
  keyboard.push([{ text: "❌ Cancel", callback_data: `cancel_${botMessageId}` }]);

  return keyboard;
}

/**
 * Refresh the wizard UI
 */
async function refreshWizardUI(session: any, chatId: number, botMessageId: number) {
  const fields = await buildFieldsFromRule(session.category);
  const updatedFields = updateFieldCompletion(fields, session);
  const currentField = findCurrentField(updatedFields);

  const message = await formatWizardMessage(session, updatedFields, currentField);
  
  let keyboard: any[][] = [];
  
  // If there's a current field, show its options
  if (currentField) {
    const fieldKeyboard = await buildFieldKeyboard(currentField, session, botMessageId);
    keyboard = [...fieldKeyboard];
  }
  
  // Add navigation keyboard
  const navKeyboard = buildNavigationKeyboard(updatedFields, botMessageId);
  keyboard = [...keyboard, ...navKeyboard];

  await editMessageText(chatId, botMessageId, message, keyboard);
}

/**
 * Handle location selection with hierarchical navigation
 */
async function handleLocationSelection(
  session: any,
  locationId: string,
  fieldType: "location" | "source_location" | "target_location",
  botMessageId: number
) {
  // ✅ OPTIMIZED: Combine location lookup and child count into single Promise.all
  const [location, childCount] = await Promise.all([
    Location.findById(locationId).lean(),
    Location.countDocuments({ 
      parentLocationId: locationId, 
      isActive: true 
    })
  ]);
  
  if (!location) return false;

  // Determine which path to update
  let pathField = "locationPath";
  let completeField = "locationComplete";
  if (fieldType === "source_location") {
    pathField = "sourceLocationPath";
    completeField = "sourceLocationComplete";
  } else if (fieldType === "target_location") {
    pathField = "targetLocationPath";
    completeField = "targetLocationComplete";
  }

  // Get current path - this represents our navigation history
  const currentPath = session[pathField] || [];
  
  // ✅ FIX: Check if this location is already in the path to prevent duplicates
  const locationIdStr = String(location._id);
  const alreadyInPath = currentPath.some((node: any) => node.id === locationIdStr);
  
  if (alreadyInPath) {
    // Location already exists in path, skip adding it again
    return true;
  }
  
  // Append selected location to current path (incremental navigation)
  const newPath = [...currentPath, {
    id: locationIdStr,
    name: location.name
  }];

  if (childCount > 0) {
    // Has children, update path but don't mark complete
    await WizardSession.findOneAndUpdate(
      { botMessageId },
      { [pathField]: newPath }
    );
  } else {
    // Leaf node, mark complete
    await WizardSession.findOneAndUpdate(
      { botMessageId },
      { 
        [pathField]: newPath,
        [completeField]: true
      }
    );
  }

  return true;
}

/**
 * Handle location back navigation
 */
async function handleLocationBack(
  session: any,
  fieldType: "location" | "source_location" | "target_location",
  botMessageId: number
) {
  let pathField = "locationPath";
  let completeField = "locationComplete";
  if (fieldType === "source_location") {
    pathField = "sourceLocationPath";
    completeField = "sourceLocationComplete";
  } else if (fieldType === "target_location") {
    pathField = "targetLocationPath";
    completeField = "targetLocationComplete";
  }

  const currentPath = session[pathField] || [];
  if (currentPath.length > 0) {
    const newPath = currentPath.slice(0, -1);
    await WizardSession.findOneAndUpdate(
      { botMessageId },
      { 
        [pathField]: newPath,
        [completeField]: false
      }
    );
  }
}

/**
 * Create ticket from completed wizard
 */
async function createTicketFromSession(session: any, createdBy: string) {
  const category = await Category.findById(session.category).lean();
  const subcategory = session.subCategoryId ? await SubCategory.findById(session.subCategoryId).lean() : null;

  // Build location string (deduplicate to handle any existing duplicates)
  let locationStr = "Not specified";
  const dedupedPath = deduplicateLocationPath(session.locationPath);
  if (dedupedPath.length > 0) {
    locationStr = dedupedPath.map((n: any) => n.name).join(" → ");
  }

  // Get next ticket ID
  const lastTicket = await Ticket.findOne().sort({ createdAt: -1 }).lean();
  let nextTicketNumber = 1;
  if (lastTicket && lastTicket.ticketId) {
    const match = lastTicket.ticketId.match(/TCK-(\d+)/);
    if (match) {
      nextTicketNumber = parseInt(match[1]) + 1;
    }
  }
  const nextTicketId = `TCK-${String(nextTicketNumber).padStart(3, '0')}`;

  const ticketData: any = {
    ticketId: nextTicketId,
    description: session.originalText || "No description",
    category: category?.name || "unknown",
    categoryDisplay: category?.displayName || "Unknown",
    subCategory: subcategory?.name,
    priority: session.priority || "medium",
    location: locationStr,
    status: "PENDING",
    createdBy,
    photos: session.photos || [],
    additionalFields: session.additionalFieldValues || {},
    originalMessageId: session.originalMessageId, // Store original message ID
  };

  // Add agency info if present
  if (session.agencyRequired) {
    ticketData.agencyName = session.agencyName || "Unknown Agency";
    if (session.agencyDate) {
      ticketData.agencyDate = session.agencyDate;
    }
  }

  // Add source/target locations if transfer (deduplicate to handle any existing duplicates)
  if (session.sourceLocationPath) {
    ticketData.sourceLocation = deduplicateLocationPath(session.sourceLocationPath).map((n: any) => n.name).join(" → ");
  }
  if (session.targetLocationPath) {
    ticketData.targetLocation = deduplicateLocationPath(session.targetLocationPath).map((n: any) => n.name).join(" → ");
  }

  const ticket = await Ticket.create(ticketData);
  return ticket;
}

/**
 * MAIN WEBHOOK HANDLER
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TelegramUpdate;
    await connectToDB();

    // ========== CALLBACK QUERY HANDLING ==========
    if (body.callback_query) {
      const callback = body.callback_query;
      const data: string = callback.data;
      const messageId = callback.message?.message_id;
      const chatId = callback.message?.chat?.id;

      if (!data || !messageId || !chatId) {
        return NextResponse.json({ ok: true });
      }

      const parts = data.split("_");
      const action = parts[0];
      const botMessageId = parseInt(parts[1]);

      // Get session
      const session = await WizardSession.findOne({ botMessageId });
      if (!session) {
        // Session expired or deleted - remove the message
        await telegramDeleteMessage(chatId, messageId);
        await answerCallbackQuery(callback.id, "Session expired");
        return NextResponse.json({ ok: true });
      }

      // === SELECT ACTION: select_<botMsgId>_<field>_<value> ===
      if (action === "select") {
        const fieldType = parts[2];
        const value = parts.slice(3).join("_");

        switch (fieldType) {
          case "category": {
            const cat = await Category.findById(value).lean();
            if (cat) {
              session.category = String(cat._id);
              session.categoryDisplay = cat.displayName;
              await session.save();
            }
            break;
          }

          case "priority": {
            session.priority = value as "low" | "medium" | "high";
            await session.save();
            break;
          }

          case "subcategory": {
            const sub = await SubCategory.findById(value).lean();
            if (sub) {
              session.subCategoryId = String(sub._id);
              session.subCategoryDisplay = sub.name;
              await session.save();
            }
            break;
          }

          case "location":
          case "source_location":
          case "target_location": {
            await handleLocationSelection(session, value, fieldType as any, botMessageId);
            // ✅ OPTIMIZED: Removed redundant session reload - handleLocationSelection already updates the session
            break;
          }

          case "agency": {
            if (value === "no") {
              session.agencyRequired = false;
              session.agencyName = null;
              session.agencyDate = null;
            } else {
              session.agencyRequired = true;
              session.agencyName = value;
            }
            await session.save();
            break;
          }

          case "additional": {
            const fieldKey = parts[3];
            const fieldValue = parts.slice(4).join("_");
            if (!session.additionalFieldValues) {
              session.additionalFieldValues = {};
            }
            session.additionalFieldValues[fieldKey] = fieldValue;
            await session.save();
            break;
          }
        }

        await refreshWizardUI(session, chatId, botMessageId);
        await answerCallbackQuery(callback.id, "✓");
        return NextResponse.json({ ok: true });
      }

      // === BACK ACTION: back_<botMsgId>_<fieldType> ===
      if (action === "back") {
        const fieldType = parts[2] as "location" | "source_location" | "target_location";
        await handleLocationBack(session, fieldType, botMessageId);
        await refreshWizardUI(session, chatId, botMessageId);
        await answerCallbackQuery(callback.id);
        return NextResponse.json({ ok: true });
      }

      // === JUMP ACTION: jump_<botMsgId>_<fieldKey> ===
      if (action === "jump") {
        const fieldKey = parts[2];
        // Mark that field as incomplete to allow re-selection
        switch (fieldKey) {
          case "category":
            session.category = null;
            break;
          case "priority":
            session.priority = null;
            break;
          case "subcategory":
            session.subCategoryId = null;
            session.subCategoryDisplay = null;
            break;
          case "location":
            session.locationComplete = false;
            break;
          case "source_location":
            session.sourceLocationComplete = false;
            break;
          case "target_location":
            session.targetLocationComplete = false;
            break;
          case "agency":
            session.agencyName = null;
            break;
        }
        await session.save();
        await refreshWizardUI(session, chatId, botMessageId);
        await answerCallbackQuery(callback.id, "Jump back to field");
        return NextResponse.json({ ok: true });
      }

      // === INPUT ACTION: input_<botMsgId>_additional_<fieldKey> ===
      if (action === "input") {
        const fieldKey = parts.slice(3).join("_");
        session.waitingForInput = true;
        session.inputField = fieldKey;
        await session.save();
        await answerCallbackQuery(callback.id, "Please type your value");
        const message = await formatWizardMessage(
          session,
          updateFieldCompletion(await buildFieldsFromRule(session.category), session),
          null
        );
        await editMessageText(chatId, botMessageId, message + "\n\n✍️ Type your value below:", []);
        return NextResponse.json({ ok: true });
      }

      // === SUBMIT ACTION: submit_<botMsgId> ===
      if (action === "submit") {
        const fields = await buildFieldsFromRule(session.category);
        const updatedFields = updateFieldCompletion(fields, session);
        const allComplete = updatedFields.filter(f => f.required).every(f => f.completed);

        if (!allComplete) {
          await answerCallbackQuery(callback.id, "Please complete all required fields", true);
          return NextResponse.json({ ok: true });
        }

        const createdBy = callback.from?.username || 
                         `${callback.from?.first_name || ""} ${callback.from?.last_name || ""}`.trim();

        // Delete session FIRST to prevent duplicate submissions
        const sessionData = session.toObject();
        await WizardSession.deleteOne({ botMessageId });

        try {
          // Create ticket using session data
          const ticket = await createTicketFromSession(sessionData, createdBy);

          const ticketMsg = `🎫 <b>Ticket #${ticket.ticketId} Created</b>\n\n` +
                           `📝 ${ticket.description}\n` +
                           `📂 ${ticket.category}\n` +
                           `⚡ ${ticket.priority}\n` +
                           `📍 ${ticket.location}\n` +
                           `👤 ${createdBy}`;

          const sentMsg = await telegramSendMessage(chatId, ticketMsg);
          
          if (sentMsg.ok && sentMsg.result) {
            await Ticket.findByIdAndUpdate(ticket._id, {
              telegramMessageId: sentMsg.result.message_id,
              telegramChatId: chatId
            });
          }
          await telegramDeleteMessage(chatId, botMessageId);
          await answerCallbackQuery(callback.id, "Ticket created!");
        } catch (err) {
          console.error("Ticket creation error:", err);
          await answerCallbackQuery(callback.id, "Error creating ticket", true);
        }
        
        return NextResponse.json({ ok: true });
      }

      // === CANCEL ACTION: cancel_<botMsgId> ===
      if (action === "cancel") {
        await WizardSession.deleteOne({ botMessageId });
        await editMessageText(chatId, botMessageId, "❌ Wizard cancelled", []);
        await answerCallbackQuery(callback.id, "Cancelled");
        return NextResponse.json({ ok: true });
      }

      await answerCallbackQuery(callback.id);
      return NextResponse.json({ ok: true });
    }

    // ========== MESSAGE HANDLING ==========
    const msg = body.message || body.edited_message;
    if (!msg || msg.from?.is_bot) return NextResponse.json({ ok: true });

    const chat = msg.chat;
    if (chat.type !== "group" && chat.type !== "supergroup") {
      return NextResponse.json({ ok: true });
    }

    const incomingText = (msg.text || msg.caption || "").trim();

// Check for reply to ticket message (Completion)
if (msg.reply_to_message) {
  const replyId = msg.reply_to_message.message_id;
  const lowerText = incomingText.toLowerCase();
  const completionKeywords = ["done", "ok", "completed", "fixed", "resolved"];

  if (completionKeywords.some(k => lowerText.includes(k))) {
    // Check both ticket confirmation message and original user message
    const ticket = await Ticket.findOne({
      $or: [
        { telegramMessageId: replyId },
        { originalMessageId: replyId }
      ]
    });
    
    if (ticket && ticket.status !== "COMPLETED") {
      const completedBy = msg.from.username || 
                         `${msg.from.first_name || ""} ${msg.from.last_name || ""}`.trim();
      
      // Handle completion photo if present
      let completionPhotoUrl: string | null = null;
      if (msg.photo || msg.document) {
        try {
          const { downloadTelegramFileBuffer } = await import("@/lib/downloadTelegramFileBuffer");
          const { uploadBufferToCloudinary } = await import("@/lib/uploadBufferToCloudinary");
          const fileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : msg.document?.file_id;
          if (fileId) {
            const buffer = await downloadTelegramFileBuffer(fileId);
            completionPhotoUrl = await uploadBufferToCloudinary(buffer);
          }
        } catch (err) {
          console.error("Completion photo upload failed:", err);
        }
      }

      ticket.status = "COMPLETED";
      ticket.completedBy = completedBy;
      ticket.completedAt = new Date();
      
      // ✅ Add completion photo with proper null check
      if (completionPhotoUrl) {
        if (!ticket.completionPhotos || !Array.isArray(ticket.completionPhotos)) {
          ticket.completionPhotos = [];
        }
        ticket.completionPhotos.push(completionPhotoUrl);
      }
      
      await ticket.save();

      let completionMsg = `✅ <b>Ticket #${ticket.ticketId} Completed</b>\n\n` +
                         `👤 Completed by: ${completedBy}`;
      
      if (completionPhotoUrl) {
        completionMsg += `\n📸 After-fix photo attached`;
      }

      await telegramSendMessage(
        chat.id,
        completionMsg,
        msg.message_id
      );
      return NextResponse.json({ ok: true });
    }
  }
}

    // Check for active waiting-for-input session
    const activeSession = await WizardSession.findOne({
      userId: msg.from.id,
      waitingForInput: true
    }).sort({ createdAt: -1 });

    if (activeSession && incomingText) {
      // Handle input
      const fieldKey = activeSession.inputField;
      if (fieldKey && fieldKey.startsWith("additional_")) {
        const key = fieldKey.replace("additional_", "");
        if (!activeSession.additionalFieldValues) {
          activeSession.additionalFieldValues = {};
        }
        activeSession.additionalFieldValues[key] = incomingText;
      } else if (fieldKey === "agency_date") {
        const parsed = new Date(incomingText);
        if (!isNaN(parsed.getTime())) {
          activeSession.agencyDate = parsed;
        }
      }

      activeSession.waitingForInput = false;
      activeSession.inputField = null;
      await activeSession.save();

      await refreshWizardUI(activeSession, chat.id, activeSession.botMessageId);
      return NextResponse.json({ ok: true });
    }

    // Handle photo upload
    let uploadedPhotoUrl: string | null = null;
    if (msg.photo || msg.document) {
      try {
        const { downloadTelegramFileBuffer } = await import("@/lib/downloadTelegramFileBuffer");
        const { uploadBufferToCloudinary } = await import("@/lib/uploadBufferToCloudinary");
        const fileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : msg.document?.file_id;
        if (fileId) {
          const buffer = await downloadTelegramFileBuffer(fileId);
          uploadedPhotoUrl = await uploadBufferToCloudinary(buffer);
        }
      } catch (err) {
        console.error("Photo upload failed:", err);
      }
    }

    // Create new wizard if message qualifies
    const hasPhoto = !!uploadedPhotoUrl;
    const hasText = incomingText.length > 5;
    
    if (hasPhoto || hasText) {
      const description = incomingText || "Photo attachment";
      const initialPhotos = uploadedPhotoUrl ? [uploadedPhotoUrl] : [];

      // Auto-detect category
      let detectedCategoryId: string | null = null;
      const categories = await Category.find({ isActive: true }).lean();
      const lowerText = incomingText.toLowerCase();
      for (const cat of categories) {
        if (cat.keywords && cat.keywords.some(kw => lowerText.includes(kw.toLowerCase()))) {
          detectedCategoryId = String(cat._id);
          break;
        }
      }

      // Send initial wizard message
      const initialMsg = "🛠 <b>Ticket Wizard</b>\n📝 Creating your ticket...\n\nPlease wait...";
      const botRes = await telegramSendMessage(chat.id, initialMsg, msg.message_id, []);
      const botMessageId = (botRes as any)?.result?.message_id;

      if (botMessageId) {
        // Create session
        const newSession = await WizardSession.create({
          chatId: chat.id,
          userId: msg.from.id,
          botMessageId,
          originalMessageId: msg.message_id, // Store original message ID
          originalText: description,
          photos: initialPhotos,
          category: detectedCategoryId,
          categoryDisplay: detectedCategoryId ? 
            (await Category.findById(detectedCategoryId).lean())?.displayName : null,
          createdAt: new Date(),
        });

        // Refresh UI with proper fields
        await refreshWizardUI(newSession, chat.id, botMessageId);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({
      ok: false,
      error: (err as any)?.message || String(err),
    });
  }
}
