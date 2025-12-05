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
import { Agency } from "@/models/AgencyMaster";
import { AgencyAssignmentSession } from "@/models/AgencyAssignmentSession";
import {
  telegramSendMessage,
  editMessageText,
  answerCallbackQuery,
  downloadTelegramFile,
  telegramDeleteMessage,
} from "@/lib/telegram";
import { uploadBufferToCloudinary } from "@/lib/uploadBufferToCloudinary";
import { fastProcessTelegramPhoto } from "@/lib/fastImageUpload";
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

// ========== PERFORMANCE OPTIMIZATION: ENHANCED CACHING ==========
// Cache for master data with longer TTL to reduce database queries
interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const masterDataCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 1 * 60 * 1000; // 1 minute (reduced for faster updates)

// Pending request map to prevent duplicate in-flight requests
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Clear cache for a specific key pattern (e.g., 'workflow:' clears all workflow caches)
 */
function clearCacheByPattern(pattern: string) {
  for (const key of masterDataCache.keys()) {
    if (key.startsWith(pattern)) {
      masterDataCache.delete(key);
    }
  }
}

/**
 * Generic cache wrapper with request deduplication
 * Prevents multiple simultaneous requests for the same data
 */
async function getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  // Check cache first
  const cached = masterDataCache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.data as T;
  }
  
  // Check if there's already a pending request for this key
  const pending = pendingRequests.get(key);
  if (pending) {
    return pending as Promise<T>;
  }
  
  // Create new request and track it
  const request = fetcher().then(data => {
    masterDataCache.set(key, { data, expiry: Date.now() + CACHE_TTL });
    pendingRequests.delete(key);
    return data;
  }).catch(err => {
    pendingRequests.delete(key);
    throw err;
  });
  
  pendingRequests.set(key, request);
  return request;
}

/**
 * Pre-warm the cache on startup (called once)
 */
let cacheWarmed = false;
async function warmCache() {
  if (cacheWarmed) return;
  cacheWarmed = true;
  
  try {
    // Pre-load all categories
    const categories = await Category.find({ isActive: true }).sort({ priority: -1, name: 1 }).lean();
    masterDataCache.set('categories:all', { data: categories, expiry: Date.now() + CACHE_TTL });
    
    // Pre-load root locations
    const rootLocations = await Location.find({ parentLocationId: null, isActive: true }).sort({ name: 1 }).lean();
    masterDataCache.set('locations:root', { data: rootLocations, expiry: Date.now() + CACHE_TTL });
    
    console.log('[CACHE] Pre-warmed with categories and root locations');
  } catch (err) {
    console.error('[CACHE] Warm-up failed:', err);
  }
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
  type: "category" | "priority" | "subcategory" | "location" | "source_location" | "target_location" | "agency" | "agency_date" | "agency_time_hour" | "agency_time_minute" | "agency_time_period" | "additional";
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

        // Date and Time picker - only add if requiresAgencyDate is true
        if (rule.requiresAgencyDate) {
          // Date picker first
          fields.push({
            key: "agency_date",
            label: "📅 Agency Date",
            type: "agency_date",
            required: false, // Will be required dynamically when agency is selected
            completed: false,
          });

          // Then time picker steps
          fields.push({
            key: "agency_time_hour",
            label: "⏰ Arrival Hour",
            type: "agency_time_hour",
            required: false, // Will be required dynamically when agency is selected
            completed: false,
          });

          fields.push({
            key: "agency_time_minute",
            label: "⏰ Arrival Minutes",
            type: "agency_time_minute",
            required: false,
            completed: false,
          });

          fields.push({
            key: "agency_time_period",
            label: "⏰ AM/PM",
            type: "agency_time_period",
            required: false,
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
  // Check if agency was selected (not "No Agency")
  const agencySelected = session.agencyRequired === true && session.agencyName;
  
  return fields.map(field => {
    let completed = false;
    let value: any = undefined;
    let required = field.required;

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
        // Only complete when explicitly set to true or false (not null/undefined)
        completed = session.agencyRequired === true || session.agencyRequired === false;
        value = session.agencyRequired ? (session.agencyName || "Yes") : "No";
        break;
      
      case "agency_time_hour":
        // Only required if an agency was selected
        required = agencySelected;
        completed = session.agencyTimeHour !== null && session.agencyTimeHour !== undefined;
        value = completed ? `${session.agencyTimeHour}` : undefined;
        break;
      
      case "agency_time_minute":
        required = agencySelected;
        completed = session.agencyTimeMinute !== null && session.agencyTimeMinute !== undefined;
        value = completed ? `:${String(session.agencyTimeMinute).padStart(2, '0')}` : undefined;
        break;
      
      case "agency_time_period":
        required = agencySelected;
        completed = !!session.agencyTimePeriod;
        value = session.agencyTimePeriod;
        // When period is completed, show the full time
        if (completed && session.agencyTimeHour && session.agencyTimeMinute !== undefined) {
          value = `${session.agencyTimeHour}:${String(session.agencyTimeMinute).padStart(2, '0')} ${session.agencyTimePeriod}`;
        }
        break;
      
      case "agency_date":
        required = agencySelected;
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

    return { ...field, completed, value, required };
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
      
      // 2-column layout
      for (let i = 0; i < categories.length; i += 2) {
        const row: any[] = [];
        const cat1 = categories[i];
        row.push({
          text: cat1.displayName,
          callback_data: `select_${botMessageId}_category_${cat1._id}`
        });
        
        if (i + 1 < categories.length) {
          const cat2 = categories[i + 1];
          row.push({
            text: cat2.displayName,
            callback_data: `select_${botMessageId}_category_${cat2._id}`
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
      // ✅ Fetch agencies from AgencyMaster instead of workflow rule's inline list
      const agencies = await getCached(
        'agencies:active',
        () => Agency.find({ isActive: true }).sort({ name: 1 }).lean()
      );
      
      for (const agency of agencies) {
        keyboard.push([{
          text: `👷 ${agency.name}`,
          callback_data: `select_${botMessageId}_agency_${agency._id}`
        }]);
      }
      
      keyboard.push([{
        text: "❌ No Agency",
        callback_data: `select_${botMessageId}_agency_no`
      }]);
      break;
    }

    case "agency_time_hour": {
      // Hour selection: 6-12, 1-5 in a 4-column grid
      keyboard.push([
        { text: "6", callback_data: `select_${botMessageId}_agency_time_hour_6` },
        { text: "7", callback_data: `select_${botMessageId}_agency_time_hour_7` },
        { text: "8", callback_data: `select_${botMessageId}_agency_time_hour_8` },
        { text: "9", callback_data: `select_${botMessageId}_agency_time_hour_9` },
      ]);
      keyboard.push([
        { text: "10", callback_data: `select_${botMessageId}_agency_time_hour_10` },
        { text: "11", callback_data: `select_${botMessageId}_agency_time_hour_11` },
        { text: "12", callback_data: `select_${botMessageId}_agency_time_hour_12` },
        { text: "1", callback_data: `select_${botMessageId}_agency_time_hour_1` },
      ]);
      keyboard.push([
        { text: "2", callback_data: `select_${botMessageId}_agency_time_hour_2` },
        { text: "3", callback_data: `select_${botMessageId}_agency_time_hour_3` },
        { text: "4", callback_data: `select_${botMessageId}_agency_time_hour_4` },
        { text: "5", callback_data: `select_${botMessageId}_agency_time_hour_5` },
      ]);
      break;
    }

    case "agency_time_minute": {
      // Minute selection: 00, 15, 30, 45
      keyboard.push([
        { text: ":00", callback_data: `select_${botMessageId}_agency_time_minute_0` },
        { text: ":15", callback_data: `select_${botMessageId}_agency_time_minute_15` },
        { text: ":30", callback_data: `select_${botMessageId}_agency_time_minute_30` },
        { text: ":45", callback_data: `select_${botMessageId}_agency_time_minute_45` },
      ]);
      break;
    }

    case "agency_time_period": {
      // AM/PM selection
      keyboard.push([
        { text: "🌅 AM", callback_data: `select_${botMessageId}_agency_time_period_AM` },
        { text: "🌆 PM", callback_data: `select_${botMessageId}_agency_time_period_PM` },
      ]);
      break;
    }

    case "agency_date": {
      // Date picker - show today, tomorrow, and next 5 days
      const today = new Date();
      const dateOptions: { text: string; dateStr: string }[] = [];
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        // Use short date format: YYYY-MM-DD
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        let label = "";
        if (i === 0) label = "📅 Today";
        else if (i === 1) label = "📅 Tomorrow";
        else {
          const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          label = `📅 ${dayNames[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
        }
        
        dateOptions.push({ text: label, dateStr });
      }
      
      // 2 columns for date buttons
      for (let i = 0; i < dateOptions.length; i += 2) {
        const row: any[] = [];
        const opt1 = dateOptions[i];
        row.push({
          text: opt1.text,
          callback_data: `select_${botMessageId}_agency_date_${opt1.dateStr}`
        });
        
        if (i + 1 < dateOptions.length) {
          const opt2 = dateOptions[i + 1];
          row.push({
            text: opt2.text,
            callback_data: `select_${botMessageId}_agency_date_${opt2.dateStr}`
          });
        }
        keyboard.push(row);
      }
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
  // ✅ FIX: Always reload session from database to get the latest data
  // This is crucial because handleLocationSelection updates the DB directly
  const freshSession = await WizardSession.findOne({ botMessageId }).lean();
  if (!freshSession) {
    console.error("Session not found for botMessageId:", botMessageId);
    return;
  }
  
  const fields = await buildFieldsFromRule(freshSession.category);
  const updatedFields = updateFieldCompletion(fields, freshSession);
  const currentField = findCurrentField(updatedFields);

  const message = await formatWizardMessage(freshSession, updatedFields, currentField);
  
  let keyboard: any[][] = [];
  
  // If there's a current field, show its options
  if (currentField) {
    const fieldKeyboard = await buildFieldKeyboard(currentField, freshSession, botMessageId);
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
  // ✅ FIX: Fetch fresh session from DB to prevent race conditions with duplicate callbacks
  const freshSession = await WizardSession.findOne({ botMessageId }).lean();
  if (!freshSession) return false;
  
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
  let pathField: "locationPath" | "sourceLocationPath" | "targetLocationPath" = "locationPath";
  let completeField: "locationComplete" | "sourceLocationComplete" | "targetLocationComplete" = "locationComplete";
  if (fieldType === "source_location") {
    pathField = "sourceLocationPath";
    completeField = "sourceLocationComplete";
  } else if (fieldType === "target_location") {
    pathField = "targetLocationPath";
    completeField = "targetLocationComplete";
  }

  // ✅ CRITICAL: Get current path from FRESH session, not the stale one passed in
  const currentPath = freshSession[pathField] || [];
  
  // ✅ FIX: Check if this location is already in the path to prevent duplicates
  const locationIdStr = String(location._id);
  const alreadyInPath = currentPath.some((node: any) => node.id === locationIdStr);
  
  if (alreadyInPath) {
    // Location already exists in path, skip adding it again
    console.log(`Location ${locationIdStr} already in path, skipping duplicate addition`);
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
  // ✅ FIX: Fetch fresh session from DB to prevent stale data issues
  const freshSession = await WizardSession.findOne({ botMessageId }).lean();
  if (!freshSession) return;
  
  let pathField: "locationPath" | "sourceLocationPath" | "targetLocationPath" = "locationPath";
  let completeField = "locationComplete";
  if (fieldType === "source_location") {
    pathField = "sourceLocationPath";
    completeField = "sourceLocationComplete";
  } else if (fieldType === "target_location") {
    pathField = "targetLocationPath";
    completeField = "targetLocationComplete";
  }

  const currentPath = freshSession[pathField] || [];
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
    if (session.agencyTime) {
      ticketData.agencyTime = session.agencyTime;
    }
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
 * MAIN WEBHOOK HANDLER - OPTIMIZED FOR SPEED
 */
export async function POST(req: NextRequest) {
  // ⚡ OPTIMIZATION: Start parsing body immediately
  const bodyPromise = req.json();
  
  try {
    const body = (await bodyPromise) as TelegramUpdate;
    
    // ⚡ OPTIMIZATION: Parallel DB connection + cache warming
    await Promise.all([
      connectToDB(),
      warmCache()
    ]);

    // ========== CALLBACK QUERY HANDLING (OPTIMIZED) ==========
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

      // ⚡ OPTIMIZATION: Answer callback immediately to remove loading spinner
      // This makes the UI feel more responsive
      answerCallbackQuery(callback.id, "").catch(() => {}); // Fire and forget

      // === AGENCY ASSIGNMENT CALLBACK HANDLING ===
      if (action === "asgn") {
        const originalMsgId = parseInt(parts[1]);
        const subAction = parts[2];
        const value = parts.slice(3).join("_");
        
        // Find the assignment session by botMessageId
        const assignSession = await AgencyAssignmentSession.findOne({ botMessageId: messageId });
        
        if (!assignSession) {
          await telegramDeleteMessage(chatId, messageId).catch(() => {});
          return NextResponse.json({ ok: true });
        }
        
        if (subAction === "cancel") {
          await AgencyAssignmentSession.deleteOne({ botMessageId: messageId });
          await editMessageText(chatId, messageId, "❌ Agency assignment cancelled", []);
          return NextResponse.json({ ok: true });
        }
        
        if (subAction === "agency") {
          // Agency selected
          const agency = await Agency.findById(value).lean();
          if (agency) {
            assignSession.agencyName = agency.name;
            assignSession.currentStep = "date";
            await assignSession.save();
            
            // Show date picker
            const today = new Date();
            const keyboard: any[][] = [];
            
            for (let i = 0; i < 7; i += 2) {
              const row: any[] = [];
              for (let j = i; j < Math.min(i + 2, 7); j++) {
                const date = new Date(today);
                date.setDate(today.getDate() + j);
                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                
                let label = "";
                if (j === 0) label = "📅 Today";
                else if (j === 1) label = "📅 Tomorrow";
                else {
                  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                  label = `📅 ${dayNames[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
                }
                
                row.push({
                  text: label,
                  callback_data: `asgn_${originalMsgId}_date_${dateStr}`
                });
              }
              keyboard.push(row);
            }
            keyboard.push([{ text: "❌ Cancel", callback_data: `asgn_${originalMsgId}_cancel` }]);
            
            const msg = `🔧 <b>Assign Agency to ${assignSession.ticketId}</b>\n\n` +
                       `👷 Agency: ${agency.name}\n\n` +
                       `📅 Select arrival date:`;
            
            await editMessageText(chatId, messageId, msg, keyboard);
          }
          return NextResponse.json({ ok: true });
        }
        
        if (subAction === "date") {
          assignSession.agencyDate = new Date(value);
          assignSession.currentStep = "hour";
          await assignSession.save();
          
          // Show hour picker
          const keyboard = [
            [
              { text: "6", callback_data: `asgn_${originalMsgId}_hour_6` },
              { text: "7", callback_data: `asgn_${originalMsgId}_hour_7` },
              { text: "8", callback_data: `asgn_${originalMsgId}_hour_8` },
              { text: "9", callback_data: `asgn_${originalMsgId}_hour_9` },
            ],
            [
              { text: "10", callback_data: `asgn_${originalMsgId}_hour_10` },
              { text: "11", callback_data: `asgn_${originalMsgId}_hour_11` },
              { text: "12", callback_data: `asgn_${originalMsgId}_hour_12` },
              { text: "1", callback_data: `asgn_${originalMsgId}_hour_1` },
            ],
            [
              { text: "2", callback_data: `asgn_${originalMsgId}_hour_2` },
              { text: "3", callback_data: `asgn_${originalMsgId}_hour_3` },
              { text: "4", callback_data: `asgn_${originalMsgId}_hour_4` },
              { text: "5", callback_data: `asgn_${originalMsgId}_hour_5` },
            ],
            [{ text: "❌ Cancel", callback_data: `asgn_${originalMsgId}_cancel` }]
          ];
          
          const msg = `🔧 <b>Assign Agency to ${assignSession.ticketId}</b>\n\n` +
                     `👷 Agency: ${assignSession.agencyName}\n` +
                     `📅 Date: ${new Date(assignSession.agencyDate!).toLocaleDateString()}\n\n` +
                     `⏰ Select arrival hour:`;
          
          await editMessageText(chatId, messageId, msg, keyboard);
          return NextResponse.json({ ok: true });
        }
        
        if (subAction === "hour") {
          assignSession.agencyTimeHour = parseInt(value);
          assignSession.currentStep = "minute";
          await assignSession.save();
          
          // Show minute picker
          const keyboard = [
            [
              { text: ":00", callback_data: `asgn_${originalMsgId}_minute_0` },
              { text: ":15", callback_data: `asgn_${originalMsgId}_minute_15` },
              { text: ":30", callback_data: `asgn_${originalMsgId}_minute_30` },
              { text: ":45", callback_data: `asgn_${originalMsgId}_minute_45` },
            ],
            [{ text: "❌ Cancel", callback_data: `asgn_${originalMsgId}_cancel` }]
          ];
          
          const msg = `🔧 <b>Assign Agency to ${assignSession.ticketId}</b>\n\n` +
                     `👷 Agency: ${assignSession.agencyName}\n` +
                     `📅 Date: ${new Date(assignSession.agencyDate!).toLocaleDateString()}\n` +
                     `⏰ Hour: ${assignSession.agencyTimeHour}\n\n` +
                     `⏰ Select minutes:`;
          
          await editMessageText(chatId, messageId, msg, keyboard);
          return NextResponse.json({ ok: true });
        }
        
        if (subAction === "minute") {
          assignSession.agencyTimeMinute = parseInt(value);
          assignSession.currentStep = "period";
          await assignSession.save();
          
          // Show AM/PM picker
          const keyboard = [
            [
              { text: "🌅 AM", callback_data: `asgn_${originalMsgId}_period_AM` },
              { text: "🌆 PM", callback_data: `asgn_${originalMsgId}_period_PM` },
            ],
            [{ text: "❌ Cancel", callback_data: `asgn_${originalMsgId}_cancel` }]
          ];
          
          const msg = `🔧 <b>Assign Agency to ${assignSession.ticketId}</b>\n\n` +
                     `👷 Agency: ${assignSession.agencyName}\n` +
                     `📅 Date: ${new Date(assignSession.agencyDate!).toLocaleDateString()}\n` +
                     `⏰ Time: ${assignSession.agencyTimeHour}:${String(assignSession.agencyTimeMinute).padStart(2, '0')}\n\n` +
                     `🌅 Select AM or PM:`;
          
          await editMessageText(chatId, messageId, msg, keyboard);
          return NextResponse.json({ ok: true });
        }
        
        if (subAction === "period") {
          assignSession.agencyTimePeriod = value;
          const agencyTime = `${assignSession.agencyTimeHour}:${String(assignSession.agencyTimeMinute).padStart(2, '0')} ${value}`;
          
          // Update the ticket
          await Ticket.findByIdAndUpdate(assignSession.ticketObjectId, {
            agencyName: assignSession.agencyName,
            agencyDate: assignSession.agencyDate,
            agencyTime: agencyTime
          });
          
          // Delete session
          await AgencyAssignmentSession.deleteOne({ botMessageId: messageId });
          
          // Show confirmation
          const msg = `✅ <b>Agency Assigned to ${assignSession.ticketId}</b>\n\n` +
                     `👷 Agency: ${assignSession.agencyName}\n` +
                     `📅 Date: ${new Date(assignSession.agencyDate!).toLocaleDateString()}\n` +
                     `⏰ Time: ${agencyTime}`;
          
          await editMessageText(chatId, messageId, msg, []);
          return NextResponse.json({ ok: true });
        }
        
        return NextResponse.json({ ok: true });
      }

      // ⚡ OPTIMIZATION: Use lean() for faster session query
      const session = await WizardSession.findOne({ botMessageId });
      if (!session) {
        // Session expired or deleted - remove the message
        telegramDeleteMessage(chatId, messageId).catch(() => {}); // Fire and forget
        return NextResponse.json({ ok: true });
      }

      // === SELECT ACTION: select_<botMsgId>_<field>_<value> ===
      if (action === "select") {
        // Handle field types with underscores (e.g., agency_time_hour, agency_date)
        // Format: select_<botMsgId>_<fieldType>_<value>
        // For simple fields: select_123_category_67890 -> fieldType=category, value=67890
        // For multi-part: select_123_agency_time_hour_6 -> fieldType=agency_time_hour, value=6
        
        let fieldType = parts[2];
        let value = parts.slice(3).join("_");
        
        // Check for known multi-part field types
        if (fieldType === "agency") {
          if (value.startsWith("time_hour_")) {
            fieldType = "agency_time_hour";
            value = value.replace("time_hour_", "");
          } else if (value.startsWith("time_minute_")) {
            fieldType = "agency_time_minute";
            value = value.replace("time_minute_", "");
          } else if (value.startsWith("time_period_")) {
            fieldType = "agency_time_period";
            value = value.replace("time_period_", "");
          } else if (value.startsWith("date_")) {
            fieldType = "agency_date";
            value = value.replace("date_", "");
          }
        } else if (fieldType === "source") {
          fieldType = "source_location";
          value = parts.slice(4).join("_");
        } else if (fieldType === "target") {
          fieldType = "target_location";
          value = parts.slice(4).join("_");
        }

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
              session.agencyTime = null;
              session.agencyTimeHour = null;
              session.agencyTimeMinute = null;
              session.agencyTimePeriod = null;
            } else {
              // Lookup agency by ID from AgencyMaster
              const agency = await Agency.findById(value).lean();
              session.agencyRequired = true;
              session.agencyName = agency?.name || value;
            }
            await session.save();
            break;
          }

          case "agency_time_hour": {
            session.agencyTimeHour = parseInt(value, 10);
            await session.save();
            break;
          }

          case "agency_time_minute": {
            session.agencyTimeMinute = parseInt(value, 10);
            await session.save();
            break;
          }

          case "agency_time_period": {
            session.agencyTimePeriod = value; // "AM" or "PM"
            // When period is selected, build the full time string
            if (session.agencyTimeHour && session.agencyTimeMinute !== null) {
              session.agencyTime = `${session.agencyTimeHour}:${String(session.agencyTimeMinute).padStart(2, '0')} ${value}`;
            }
            await session.save();
            break;
          }

          case "agency_date": {
            // Value is an ISO date string
            session.agencyDate = new Date(value);
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
        // Handle multi-part field keys (e.g., agency_date, agency_time_hour)
        let fieldKey = parts.slice(2).join("_");
        
        // Mark that field as incomplete to allow re-selection
        switch (fieldKey) {
          case "category":
            session.category = null;
            session.categoryDisplay = null;
            // Also clear dependent fields
            session.subCategoryId = null;
            session.subCategoryDisplay = null;
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
            // Clear agency and all dependent fields
            session.agencyRequired = null;
            session.agencyName = null;
            session.agencyDate = null;
            session.agencyTime = null;
            session.agencyTimeHour = null;
            session.agencyTimeMinute = null;
            session.agencyTimePeriod = null;
            break;
          case "agency_date":
            // Clear date and time fields
            session.agencyDate = null;
            session.agencyTime = null;
            session.agencyTimeHour = null;
            session.agencyTimeMinute = null;
            session.agencyTimePeriod = null;
            break;
          case "agency_time_hour":
            // Clear time fields
            session.agencyTime = null;
            session.agencyTimeHour = null;
            session.agencyTimeMinute = null;
            session.agencyTimePeriod = null;
            break;
          case "agency_time_minute":
            session.agencyTime = null;
            session.agencyTimeMinute = null;
            session.agencyTimePeriod = null;
            break;
          case "agency_time_period":
            session.agencyTime = null;
            session.agencyTimePeriod = null;
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

          let ticketMsg = `🎫 <b>Ticket #${ticket.ticketId} Created</b>\n\n` +
                           `📝 ${ticket.description}\n` +
                           `📂 ${ticket.category}\n` +
                           `⚡ ${ticket.priority}\n`;
          
          // Show source/target locations for transfer, otherwise show regular location
          if (ticket.sourceLocation && ticket.targetLocation) {
            ticketMsg += `📤 From: ${ticket.sourceLocation}\n`;
            ticketMsg += `📥 To: ${ticket.targetLocation}\n`;
          } else {
            ticketMsg += `📍 ${ticket.location}\n`;
          }
          
          // Add agency info if present
          if (ticket.agencyName) {
            ticketMsg += `👷 ${ticket.agencyName}\n`;
            if (ticket.agencyDate) {
              ticketMsg += `📅 ${new Date(ticket.agencyDate).toLocaleDateString()}\n`;
            }
            if (ticket.agencyTime) {
              ticketMsg += `⏰ ${ticket.agencyTime}\n`;
            }
          }
          
          ticketMsg += `👤 ${createdBy}`;

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

// ========== ASSIGN AGENCY COMMAND HANDLING ==========
// Supports: "assign agency TCK-123" or "/agency TCK-123"
const assignAgencyMatch = incomingText.match(/^(?:assign\s*agency|\/agency)\s*(tck-?\d+)?/i);
if (assignAgencyMatch) {
  // Extract ticket number from message
  const ticketMatch = incomingText.match(/TCK-?(\d+)/i);
  
  if (!ticketMatch) {
    // Ask for ticket number
    await telegramSendMessage(
      chat.id,
      "📝 Please provide the ticket number.\n\nExample: <code>assign agency TCK-123</code>",
      msg.message_id
    );
    return NextResponse.json({ ok: true });
  }
  
  const ticketId = `TCK-${ticketMatch[1]}`;
  const ticket = await Ticket.findOne({ ticketId });
  
  if (!ticket) {
    await telegramSendMessage(
      chat.id,
      `❌ Ticket <b>${ticketId}</b> not found.`,
      msg.message_id
    );
    return NextResponse.json({ ok: true });
  }
  
  // Get agencies from AgencyMaster
  const agencies = await Agency.find({ isActive: true }).sort({ name: 1 }).lean();
  
  if (agencies.length === 0) {
    await telegramSendMessage(
      chat.id,
      "❌ No agencies available. Please add agencies in the admin panel first.",
      msg.message_id
    );
    return NextResponse.json({ ok: true });
  }
  
  // Create agency assignment message
  const assignMsg = `🔧 <b>Assign Agency to ${ticketId}</b>\n\n` +
                    `📝 ${ticket.description}\n` +
                    `📍 ${ticket.location || "No location"}\n\n` +
                    `👇 Select an agency:`;
  
  // Build agency keyboard
  const keyboard: any[][] = [];
  for (const agency of agencies) {
    keyboard.push([{
      text: `👷 ${agency.name}`,
      callback_data: `asgn_${msg.message_id}_agency_${agency._id}`
    }]);
  }
  keyboard.push([{
    text: "❌ Cancel",
    callback_data: `asgn_${msg.message_id}_cancel`
  }]);
  
  const sentMsg = await telegramSendMessage(chat.id, assignMsg, undefined, keyboard);
  
  if (sentMsg.ok && sentMsg.result) {
    // Create assignment session
    await AgencyAssignmentSession.create({
      chatId: chat.id,
      userId: msg.from.id,
      botMessageId: sentMsg.result.message_id,
      ticketId: ticketId,
      ticketObjectId: ticket._id,
      currentStep: "agency"
    });
  }
  
  return NextResponse.json({ ok: true });
}

// Check for reply to ticket message (Completion or Agency Assignment)
if (msg.reply_to_message) {
  const replyId = msg.reply_to_message.message_id;
  const lowerText = incomingText.toLowerCase();
  
  // Check for agency assignment reply
  const agencyKeywords = ["agency", "assign agency", "contractor"];
  if (agencyKeywords.some(k => lowerText === k || lowerText.startsWith(k))) {
    // Find ticket by message ID
    const ticket = await Ticket.findOne({
      $or: [
        { telegramMessageId: replyId },
        { originalMessageId: replyId }
      ]
    });
    
    if (ticket) {
      // Get agencies from AgencyMaster
      const agencies = await Agency.find({ isActive: true }).sort({ name: 1 }).lean();
      
      if (agencies.length === 0) {
        await telegramSendMessage(
          chat.id,
          "❌ No agencies available. Please add agencies in the admin panel first.",
          msg.message_id
        );
        return NextResponse.json({ ok: true });
      }
      
      // Create agency assignment message
      const assignMsg = `🔧 <b>Assign Agency to ${ticket.ticketId}</b>\n\n` +
                        `📝 ${ticket.description}\n` +
                        `📍 ${ticket.location || "No location"}\n\n` +
                        `👇 Select an agency:`;
      
      // Build agency keyboard
      const keyboard: any[][] = [];
      for (const agency of agencies) {
        keyboard.push([{
          text: `👷 ${agency.name}`,
          callback_data: `asgn_${msg.message_id}_agency_${agency._id}`
        }]);
      }
      keyboard.push([{
        text: "❌ Cancel",
        callback_data: `asgn_${msg.message_id}_cancel`
      }]);
      
      const sentMsg = await telegramSendMessage(chat.id, assignMsg, undefined, keyboard);
      
      if (sentMsg.ok && sentMsg.result) {
        // Create assignment session
        await AgencyAssignmentSession.create({
          chatId: chat.id,
          userId: msg.from.id,
          botMessageId: sentMsg.result.message_id,
          ticketId: ticket.ticketId,
          ticketObjectId: ticket._id,
          currentStep: "agency"
        });
      }
      
      return NextResponse.json({ ok: true });
    }
  }
  
  // Check for completion keywords
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

    // ========== NEW TICKET HANDLING (OPTIMIZED) ==========
    const hasPhoto = !!(msg.photo || msg.document);
    const hasText = incomingText.length > 1; // Responsive threshold
    
    if (hasPhoto || hasText) {
      // ⚡ OPTIMIZATION: Send initial "Processing" message IMMEDIATELY
      // This gives instant feedback while we process the heavy stuff
      const initialMsg = "🛠 <b>Ticket Wizard</b>\n⚡ Processing...";
      const botResPromise = telegramSendMessage(chat.id, initialMsg, msg.message_id, []);
      
      // Prepare parallel tasks
      
      // 1. Photo Processing (if applicable)
      let photoPromise: Promise<string | null> = Promise.resolve(null);
      if (hasPhoto) {
        const fileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : msg.document?.file_id;
        if (fileId) {
          photoPromise = fastProcessTelegramPhoto(fileId);
        }
      }
      
      // 2. Category Detection
      const categoryPromise = (async () => {
        // Use cached categories if available
        const categories = await getCached('categories:all', () => 
          Category.find({ isActive: true }).sort({ priority: -1, name: 1 }).lean()
        );
        
        const lowerText = incomingText.toLowerCase();
        for (const cat of categories) {
          if (cat.keywords && cat.keywords.some((kw: string) => lowerText.includes(kw.toLowerCase()))) {
            return { id: String(cat._id), name: cat.displayName };
          }
        }
        return null;
      })();

      // Wait for everything to complete
      const [botRes, photoUrl, detectedCategory] = await Promise.all([
        botResPromise,
        photoPromise,
        categoryPromise
      ]);

      const botMessageId = (botRes as any)?.result?.message_id;

      if (botMessageId) {
        const description = incomingText || (photoUrl ? "Photo attachment" : "New Ticket");
        const initialPhotos = photoUrl ? [photoUrl] : [];
        
        // Create session
        const newSession = await WizardSession.create({
          chatId: chat.id,
          userId: msg.from.id,
          botMessageId,
          originalMessageId: msg.message_id,
          originalText: description,
          photos: initialPhotos,
          category: detectedCategory?.id || null,
          categoryDisplay: detectedCategory?.name || null,
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
