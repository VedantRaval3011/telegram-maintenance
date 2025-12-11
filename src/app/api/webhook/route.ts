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
import { Information } from "@/models/Information";
import {
  telegramSendMessage,
  editMessageText,
  answerCallbackQuery,
  downloadTelegramFile,
  telegramDeleteMessage,
} from "@/lib/telegram";
import { uploadBufferToCloudinary } from "@/lib/uploadBufferToCloudinary";
import { fastProcessTelegramPhoto, fastProcessTelegramVideo } from "@/lib/fastImageUpload";

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
  type: "category" | "priority" | "subcategory" | "location" | "source_location" | "target_location" | "agency" | "agency_date" | "agency_time_slot" | "add_or_repair" | "additional";
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

  // Always include category first
  fields.push({
    key: "category",
    label: "📂 Category",
    type: "category",
    required: true,
    completed: false,
  });

  // Priority will be added later, before agency

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

      // Add or Repair (comes after subcategory, before location/agency)
      if (rule.requiresAddOrRepair) {
        fields.push({
          key: "add_or_repair",
          label: "🔧 Add New or Repair",
          type: "add_or_repair",
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

      // Priority (comes after locations, before agency)
      fields.push({
        key: "priority",
        label: "⚡ Priority",
        type: "priority",
        required: true,
        completed: false,
      });

      // Agency - Directly show agency list
      if (rule.requiresAgency) {
        // Show agency list directly (removed Yes/No confirmation step)
        fields.push({
          key: "agency",
          label: "👷 Select Agency",
          type: "agency",
          required: true,
          completed: false,
        });

        // Date and Time picker - only add if requiresAgencyDate is true
        if (rule.requiresAgencyDate) {
          // Day picker (uses current month automatically)
          fields.push({
            key: "agency_date",
            label: "📅 Agency Date",
            type: "agency_date",
            required: false, // Will be required dynamically when agency is selected
            completed: false,
          });

          // Time slot picker (First Half / Second Half)
          fields.push({
            key: "agency_time_slot",
            label: "⏰ Time Slot",
            type: "agency_time_slot",
            required: false, // Will be required dynamically when agency is selected
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
    } else {
      // No rule found - add priority as fallback
      fields.push({
        key: "priority",
        label: "⚡ Priority",
        type: "priority",
        required: true,
        completed: false,
      });
    }
  } else {
    // No category selected yet - add priority for initial display
    fields.push({
      key: "priority",
      label: "⚡ Priority",
      type: "priority",
      required: true,
      completed: false,
    });
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
        // Agency is required when this field is present
        completed = !!session.agencyName;
        value = session.agencyName || undefined;
        break;
      
      case "agency_time_slot":
        // Only required if an agency was selected
        required = !!session.agencyName;
        completed = !!session.agencyTimeSlot;
        value = session.agencyTimeSlot === "first_half" ? "🌅 First Half" : session.agencyTimeSlot === "second_half" ? "🌆 Second Half" : undefined;
        break;
      
      
      case "agency_date":
        // Required if agency was selected
        required = !!session.agencyName;
        // Complete if date is set OR date was intentionally skipped
        completed = !!session.agencyDate || !!session.agencyDateSkipped;
        if (session.agencyDateSkipped) {
          value = "❌ No Date Given";
        } else if (session.agencyDate) {
          const date = new Date(session.agencyDate);
          const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          value = `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
        }
        break;
      
      case "add_or_repair":
        completed = !!session.addOrRepairChoice;
        value = session.addOrRepairChoice === "add" ? "➕ Add" : session.addOrRepairChoice === "repair" ? "🔧 Repair" : undefined;
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
        // 2-column layout
        for (let i = 0; i < subcats.length; i += 2) {
          const row: any[] = [];
          row.push({
            text: subcats[i].name,
            callback_data: `select_${botMessageId}_subcategory_${subcats[i]._id}`
          });
          if (i + 1 < subcats.length) {
            row.push({
              text: subcats[i + 1].name,
              callback_data: `select_${botMessageId}_subcategory_${subcats[i + 1]._id}`
            });
          }
          keyboard.push(row);
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

  // 2-column layout for locations
  for (let i = 0; i < locations.length; i += 2) {
    const row: any[] = [];
    row.push({
      text: locations[i].name,
      callback_data: `select_${botMessageId}_${field.type}_${locations[i]._id}`
    });
    if (i + 1 < locations.length) {
      row.push({
        text: locations[i + 1].name,
        callback_data: `select_${botMessageId}_${field.type}_${locations[i + 1]._id}`
      });
    }
    keyboard.push(row);
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
      // ✅ Fetch agencies linked to the selected subcategory OR category (fallback)
      let agencies: any[] = [];
      
      // First try subcategory
      if (session.subCategoryId) {
        const subCategoryDoc = await SubCategory.findById(session.subCategoryId).lean();
        
        if (subCategoryDoc && subCategoryDoc.agencies && subCategoryDoc.agencies.length > 0) {
          // Only show agencies linked to this subcategory
          agencies = await Agency.find({ 
            _id: { $in: subCategoryDoc.agencies },
            isActive: true 
          }).sort({ name: 1 }).lean();
        }
      }
      
      // If no agencies from subcategory, try category (legacy fallback)
      if (agencies.length === 0 && session.category) {
        const categoryDoc = await Category.findById(session.category).lean();
        
        if (categoryDoc && categoryDoc.agencies && categoryDoc.agencies.length > 0) {
          // Only show agencies linked to this category
          agencies = await Agency.find({ 
            _id: { $in: categoryDoc.agencies },
            isActive: true 
          }).sort({ name: 1 }).lean();
        }
      }
      
      // If still no agencies, show all active agencies as fallback
      if (agencies.length === 0) {
        agencies = await getCached(
          'agencies:active',
          () => Agency.find({ isActive: true }).sort({ name: 1 }).lean()
        );
      }
      
      // 2-column layout for agencies
      for (let i = 0; i < agencies.length; i += 2) {
        const row: any[] = [];
        row.push({
          text: `👷 ${agencies[i].name}`,
          callback_data: `select_${botMessageId}_agency_${agencies[i]._id}`
        });
        if (i + 1 < agencies.length) {
          row.push({
            text: `👷 ${agencies[i + 1].name}`,
            callback_data: `select_${botMessageId}_agency_${agencies[i + 1]._id}`
          });
        }
        keyboard.push(row);
      }
      break;
    }

    case "agency_time_slot": {
      // Time slot selection: First Half / Second Half
      keyboard.push([
        { text: "🌅 First Half", callback_data: `select_${botMessageId}_agency_time_slot_first_half` },
        { text: "🌆 Second Half", callback_data: `select_${botMessageId}_agency_time_slot_second_half` },
      ]);
      break;
    }

    case "agency_date": {
      // Day picker - automatically use current month
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      
      // Get the number of days in the current month
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      
      // Add a header row showing current month
      keyboard.push([{
        text: `📅 ${monthNames[currentMonth]} ${currentYear}`,
        callback_data: `noop_${botMessageId}` // Non-interactive header
      }]);
      
      // Create day buttons (7 columns)
      for (let day = 1; day <= daysInMonth; day += 7) {
        const row: any[] = [];
        for (let d = day; d < day + 7 && d <= daysInMonth; d++) {
          // Create the full date string
          const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          row.push({
            text: `${d}`,
            callback_data: `select_${botMessageId}_agency_date_${dateStr}`
          });
        }
        keyboard.push(row);
      }
      
      // Add "No Date Given" option for when agency hasn't provided a date
      keyboard.push([{
        text: "❌ No Date Given",
        callback_data: `select_${botMessageId}_agency_date_no_date`
      }]);
      break;
    }

    case "add_or_repair": {
      // Add or Repair choice
      keyboard.push([
        { text: "➕ Add", callback_data: `select_${botMessageId}_add_or_repair_add` },
        { text: "🔧 Repair", callback_data: `select_${botMessageId}_add_or_repair_repair` },
      ]);
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

  // Videos
  if (session.videos && session.videos.length > 0) {
    message += `🎬 Videos: ${session.videos.length} attached\n`;
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
    const match = lastTicket.ticketId.match(/T-(\d+)/);
    if (match) {
      nextTicketNumber = parseInt(match[1]) + 1;
    }
  }
  const nextTicketId = `T-${nextTicketNumber}`;

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
    videos: session.videos || [],
    additionalFields: session.additionalFieldValues || {},
    originalMessageId: session.originalMessageId, // Store original message ID
  };

  // Add agency info if present
  if (session.agencyRequired) {
    ticketData.agencyName = session.agencyName || "Unknown Agency";
    if (session.agencyTimeSlot) {
      // Convert time slot to human-readable format for display
      ticketData.agencyTime = session.agencyTimeSlot === "first_half" ? "First Half" : "Second Half";
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

  // Add or Repair choice
  if (session.addOrRepairChoice) {
    ticketData.addOrRepairChoice = session.addOrRepairChoice;
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
          assignSession.currentStep = "time_slot";
          await assignSession.save();
          
          // Show time slot picker (First Half / Second Half)
          const keyboard = [
            [
              { text: "🌅 First Half", callback_data: `asgn_${originalMsgId}_time_slot_first_half` },
              { text: "🌆 Second Half", callback_data: `asgn_${originalMsgId}_time_slot_second_half` },
            ],
            [{ text: "❌ Cancel", callback_data: `asgn_${originalMsgId}_cancel` }]
          ];
          
          const msg = `🔧 <b>Assign Agency to ${assignSession.ticketId}</b>\n\n` +
                     `👷 Agency: ${assignSession.agencyName}\n` +
                     `📅 Date: ${new Date(assignSession.agencyDate!).toLocaleDateString()}\n\n` +
                     `⏰ Select time slot:`;
          
          await editMessageText(chatId, messageId, msg, keyboard);
          return NextResponse.json({ ok: true });
        }
        
        if (subAction === "time_slot") {
          const agencyTime = value === "first_half" ? "First Half" : "Second Half";
          
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
          if (value.startsWith("time_slot_")) {
            fieldType = "agency_time_slot";
            value = value.replace("time_slot_", "");
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
        } else if (fieldType === "add") {
          // Handle add_or_repair multi-part field type
          // Callback data: select_123_add_or_repair_add or select_123_add_or_repair_repair
          if (value.startsWith("or_repair_")) {
            fieldType = "add_or_repair";
            value = value.replace("or_repair_", ""); // "add" or "repair"
          }
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
            // Lookup agency by ID from AgencyMaster
            const agency = await Agency.findById(value).lean();
            session.agencyName = agency?.name || value;
            session.agencyRequired = true; // Mark agency as required when selected
            await session.save();
            break;
          }

          case "agency_time_slot": {
            session.agencyTimeSlot = value; // "first_half" or "second_half"
            await session.save();
            break;
          }

          case "agency_date": {
            // Value is an ISO date string OR "no_date"
            if (value === "no_date") {
              // Mark as "no date provided" - we use a special marker
              session.agencyDate = null;
              session.agencyDateSkipped = true; // Mark that date was intentionally skipped
            } else {
              session.agencyDate = new Date(value);
              session.agencyDateSkipped = false;
            }
            await session.save();
            break;
          }

          case "add_or_repair": {
            session.addOrRepairChoice = value as "add" | "repair";
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
            // Clear agency name and dependent fields
            session.agencyName = null;
            session.agencyDate = null;
            session.agencyDateSkipped = false;
            session.agencyTimeSlot = null;
            break;

          case "agency_date":
            // Clear date and time slot fields
            session.agencyDate = null;
            session.agencyDateSkipped = false;
            session.agencyTimeSlot = null;
            break;
          case "agency_time_slot":
            // Clear time slot field
            session.agencyTimeSlot = null;
            break;
          case "add_or_repair":
            // Clear add or repair choice
            session.addOrRepairChoice = null;
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
          
          // Show photo/video counts if present
          const photoCount = ticket.photos?.length || 0;
          const videoCount = ticket.videos?.length || 0;
          if (photoCount > 0 || videoCount > 0) {
            let mediaInfo = '';
            if (photoCount > 0) mediaInfo += `📸 ${photoCount} photo${photoCount > 1 ? 's' : ''}`;
            if (photoCount > 0 && videoCount > 0) mediaInfo += ' • ';
            if (videoCount > 0) mediaInfo += `🎬 ${videoCount} video${videoCount > 1 ? 's' : ''}`;
            ticketMsg += `${mediaInfo}\n`;
          }
          
          ticketMsg += `👤 ${createdBy}`;

          // ✅ CRITICAL: Reply to the original message (the image) so users know which image the ticket was created for
          const replyToMessageId = sessionData.originalMessageId;
          const sentMsg = await telegramSendMessage(chatId, ticketMsg, replyToMessageId);
          
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

// ========== INFO COMMAND HANDLING ==========
// Captures any message starting with /info and stores the content
// Format: /info <any text here>
if (incomingText.toLowerCase().startsWith("/info ")) {
  const infoContent = incomingText.substring(6).trim(); // Remove "/info " prefix
  
  if (infoContent.length > 0) {
    const createdBy = msg.from?.username || 
                     `${msg.from?.first_name || ""} ${msg.from?.last_name || ""}`.trim() ||
                     "Unknown";
    
    try {
      // Store the information
      await Information.create({
        content: infoContent,
        createdBy,
        telegramMessageId: msg.message_id,
        telegramChatId: chat.id,
      });
      
      // Send confirmation
      await telegramSendMessage(
        chat.id,
        `✅ <b>Information Saved</b>\n\n📝 ${infoContent.length > 100 ? infoContent.substring(0, 100) + "..." : infoContent}\n\n👤 By: ${createdBy}`,
        msg.message_id
      );
    } catch (error) {
      console.error("Error saving information:", error);
      await telegramSendMessage(
        chat.id,
        "❌ Failed to save information. Please try again.",
        msg.message_id
      );
    }
  } else {
    // No content provided
    await telegramSendMessage(
      chat.id,
      "📝 Please provide some information after /info\n\nExample: <code>/info Meeting scheduled at 3 PM</code>",
      msg.message_id
    );
  }
  
  return NextResponse.json({ ok: true });
}

// ========== REOPEN TICKET COMMAND HANDLING ==========
// Supports: "open T-123" or "/open T-123" or "reopen T-123" or "/edit T-123"
const reopenMatch = incomingText.match(/^(?:open|reopen|edit|\/open|\/reopen|\/edit)\s*(t-?\d+)?/i);
if (reopenMatch && !msg.reply_to_message) {
  // Extract ticket number from message
  const ticketMatch = incomingText.match(/T-?(\d+)/i);
  
  if (!ticketMatch) {
    // Ask for ticket number
    await telegramSendMessage(
      chat.id,
      "📝 Please provide the ticket number.\n\nExample: <code>open T-123</code>",
      msg.message_id
    );
    return NextResponse.json({ ok: true });
  }
  
  const ticketId = `T-${ticketMatch[1]}`;
  const ticket = await Ticket.findOne({ ticketId });
  
  if (!ticket) {
    await telegramSendMessage(
      chat.id,
      `❌ Ticket <b>${ticketId}</b> not found.`,
      msg.message_id
    );
    return NextResponse.json({ ok: true });
  }
  
  if (ticket.status === "PENDING") {
    await telegramSendMessage(
      chat.id,
      `⚠️ Ticket <b>${ticketId}</b> is already pending/open.`,
      msg.message_id
    );
    return NextResponse.json({ ok: true });
  }
  
  // Reopen the ticket
  const reopenedBy = msg.from?.username || 
                    `${msg.from?.first_name || ""} ${msg.from?.last_name || ""}`.trim() ||
                    "Unknown";
  
  ticket.status = "PENDING";
  ticket.completedBy = null;
  ticket.completedAt = null;
  await ticket.save();
  
  // Send confirmation
  const msgText = `🔄 <b>Ticket #${ticket.ticketId} Reopened</b>\n\n` +
                 `📝 ${ticket.description}\n` +
                 `📂 ${ticket.category || "Unknown"}\n` +
                 `📍 ${ticket.location || "No location"}\n\n` +
                 `👤 Reopened by: ${reopenedBy}`;
  
  await telegramSendMessage(
    chat.id,
    msgText,
    msg.message_id
  );
  
  return NextResponse.json({ ok: true });
}

// ========== ASSIGN AGENCY COMMAND HANDLING ==========
// Supports: "assign agency T-123" or "/agency T-123"
// Skip if this is a reply to a message (will be handled by reply handler below)
const assignAgencyMatch = incomingText.match(/^(?:assign\s*agency|\/agency)\s*(t-?\d+)?/i);
if (assignAgencyMatch && !msg.reply_to_message) {
  // Extract ticket number from message
  const ticketMatch = incomingText.match(/T-?(\d+)/i);
  
  if (!ticketMatch) {
    // Ask for ticket number
    await telegramSendMessage(
      chat.id,
      "📝 Please provide the ticket number.\n\nExample: <code>assign agency T-123</code>",
      msg.message_id
    );
    return NextResponse.json({ ok: true });
  }
  
  const ticketId = `T-${ticketMatch[1]}`;
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

// Check for reply to ticket message (Reopen, Completion, or Agency Assignment)
if (msg.reply_to_message) {
  const replyId = msg.reply_to_message.message_id;
  const lowerText = incomingText.toLowerCase();
  
  // Check for reopen command in reply
  const reopenKeywords = ["/open", "open", "/reopen", "reopen"];
  if (reopenKeywords.some(k => lowerText === k || lowerText.startsWith(k + " "))) {
    // Find ticket by message ID
    const ticket = await Ticket.findOne({
      $or: [
        { telegramMessageId: replyId },
        { originalMessageId: replyId }
      ]
    });
    
    if (ticket) {
      if (ticket.status === "PENDING") {
        await telegramSendMessage(
          chat.id,
          `⚠️ Ticket <b>#${ticket.ticketId}</b> is already open/pending.`,
          msg.message_id
        );
        return NextResponse.json({ ok: true });
      }
      
      // Reopen the ticket
      const reopenedBy = msg.from?.username || 
                        `${msg.from?.first_name || ""} ${msg.from?.last_name || ""}`.trim() ||
                        "Unknown";
      
      ticket.status = "PENDING";
      ticket.completedBy = null;
      ticket.completedAt = null;
      await ticket.save();
      
      // Send confirmation with full ticket details
      let reopenMsg = `🔄 <b>Ticket #${ticket.ticketId} Reopened</b>\n\n` +
                     `📝 ${ticket.description}\n` +
                     `📂 ${ticket.category || "Unknown"}\n`;
      
      // Show source/target locations for transfer, otherwise show regular location
      if (ticket.sourceLocation && ticket.targetLocation) {
        reopenMsg += `📤 From: ${ticket.sourceLocation}\n`;
        reopenMsg += `📥 To: ${ticket.targetLocation}\n`;
      } else {
        reopenMsg += `📍 ${ticket.location || "No location"}\n`;
      }
      
      reopenMsg += `\n👤 Reopened by: ${reopenedBy}`;
      
      await telegramSendMessage(
        chat.id,
        reopenMsg,
        msg.message_id
      );
      
      return NextResponse.json({ ok: true });
    }
  }
  
  // Check for agency assignment reply
  const agencyKeywords = ["agency", "/agency", "assign agency", "contractor"];
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
  const completionKeywords = ["done", "ok", "okay", "completed", "fixed", "resolved"];
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

      // Handle completion video if present
      let completionVideoUrl: string | null = null;
      if (msg.video?.file_id) {
        try {
          completionVideoUrl = await fastProcessTelegramVideo(msg.video.file_id);
        } catch (err) {
          console.error("Completion video upload failed:", err);
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

      // ✅ Add completion video with proper null check
      if (completionVideoUrl) {
        if (!ticket.completionVideos || !Array.isArray(ticket.completionVideos)) {
          ticket.completionVideos = [];
        }
        ticket.completionVideos.push(completionVideoUrl);
      }
      
      await ticket.save();

      let completionMsg = `✅ <b>Ticket #${ticket.ticketId} Completed</b>\n\n` +
                         `👤 Completed by: ${completedBy}`;
      
      if (completionPhotoUrl) {
        completionMsg += `\n📸 After-fix photo attached`;
      }
      if (completionVideoUrl) {
        completionMsg += `\n🎬 After-fix video attached`;
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
    const hasVideo = !!msg.video;
    const hasText = incomingText.length > 1; // Responsive threshold
    
    if (hasPhoto || hasVideo || hasText) {
      // 🔍 CRITICAL FIX: Check if THIS USER has an existing active session
      // This prevents photos from being attached to the wrong user's ticket
      const existingSession = await WizardSession.findOne({
        chatId: chat.id,
        userId: msg.from.id, // ✅ KEY: Filter by THIS specific user's ID
      }).sort({ createdAt: -1 }); // Get the most recent session for this user

      // === CASE 1: User has an existing session - add media to it ===
      if (existingSession && (hasPhoto || hasVideo)) {
        // Process media in parallel
        let photoUrl: string | null = null;
        let videoUrl: string | null = null;
        
        if (hasPhoto) {
          const fileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : msg.document?.file_id;
          if (fileId) {
            photoUrl = await fastProcessTelegramPhoto(fileId);
          }
        }
        
        if (hasVideo && msg.video?.file_id) {
          videoUrl = await fastProcessTelegramVideo(msg.video.file_id);
        }
        
        // Add media to existing session
        const updateData: any = {};
        if (photoUrl) {
          updateData.$push = { ...updateData.$push, photos: photoUrl };
        }
        if (videoUrl) {
          updateData.$push = { ...updateData.$push, videos: videoUrl };
        }
        
        // Also update description if text was provided with the media
        if (hasText && incomingText) {
          // Append to existing description or replace if it was just "Photo attachment"
          const currentText = existingSession.originalText;
          if (currentText === "Photo attachment" || currentText === "Video attachment" || currentText === "New Ticket") {
            updateData.originalText = incomingText;
          }
        }
        
        if (Object.keys(updateData).length > 0) {
          await WizardSession.findByIdAndUpdate(existingSession._id, updateData);
        }
        
        // Refresh the wizard UI to show updated media count
        await refreshWizardUI(existingSession, chat.id, existingSession.botMessageId);
        
        // Send a brief confirmation that media was added (without creating new wizard)
        const mediaType = photoUrl ? "📸 Photo" : "🎬 Video";
        await telegramSendMessage(
          chat.id,
          `${mediaType} added to your ticket. Total: ${(existingSession.photos?.length || 0) + (photoUrl ? 1 : 0)} photos, ${(existingSession.videos?.length || 0) + (videoUrl ? 1 : 0)} videos`,
          msg.message_id
        );
        
        return NextResponse.json({ ok: true });
      }
      
      // === CASE 2: No existing session or just text - create new session ===
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
      
      // 2. Video Processing (if applicable)
      let videoPromise: Promise<string | null> = Promise.resolve(null);
      if (hasVideo && msg.video?.file_id) {
        videoPromise = fastProcessTelegramVideo(msg.video.file_id);
      }
      
      // 3. Category Detection
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
      const [botRes, photoUrl, videoUrl, detectedCategory] = await Promise.all([
        botResPromise,
        photoPromise,
        videoPromise,
        categoryPromise
      ]);

      const botMessageId = (botRes as any)?.result?.message_id;

      if (botMessageId) {
        const description = incomingText || (photoUrl ? "Photo attachment" : (videoUrl ? "Video attachment" : "New Ticket"));
        const initialPhotos = photoUrl ? [photoUrl] : [];
        const initialVideos = videoUrl ? [videoUrl] : [];
        
        // Create session with THIS user's ID to ensure proper association
        const newSession = await WizardSession.create({
          chatId: chat.id,
          userId: msg.from.id, // ✅ CRITICAL: Always associate with the sender's user ID
          botMessageId,
          originalMessageId: msg.message_id,
          originalText: description,
          photos: initialPhotos,
          videos: initialVideos,
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
