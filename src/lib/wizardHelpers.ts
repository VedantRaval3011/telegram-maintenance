// lib/wizardHelpers.ts
import { WizardSession, IWizardSession } from "@/models/WizardSession";
import { Ticket } from "@/models/Ticket";
import { Category } from "@/models/Category";
import { SubCategory } from "@/models/SubCategoryMaster";
import { Location } from "@/models/Location";
import { WorkflowRule } from "@/models/WorkflowRuleMaster";
import { editMessageText, generateTicketId } from "./telegram";

/**
 * NOTE:
 * - This file assumes your models (Category, SubCategory, Location, WorkflowRule, WizardSession, Ticket)
 *   exist and are imported from the paths above.
 * - Keyboard layouts are simple arrays of rows; adjust to Telegram markup shape you use.
 */

/** --- Utilities --- */

function toDisplayName(s?: string | null): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function locationPathToString(path?: { id: string; name: string }[]): string {
  if (!path || path.length === 0) return "—";
  return path.map((n) => n.name).join(" > ");
}

/** --- Session CRUD --- */

export async function createWizardSession(
  chatId: number,
  userId: number,
  botMessageId: number,
  originalText: string,
  initialCategory: string | null = null,
  initialPhotos: string[] = []
): Promise<IWizardSession> {
  const session = await WizardSession.create({
    chatId,
    userId,
    botMessageId,
    originalText,
    category: initialCategory,
    subCategoryId: null,
    priority: null,
    // main location
    locationPath: [],
    selectedLocationId: null,
    locationComplete: false,
    // transfer
    sourceLocationPath: [],
    sourceLocationComplete: false,
    targetLocationPath: [],
    targetLocationComplete: false,
    // manual / custom
    customLocation: null,
    // agency & additional
    agencyRequired: null,
    agencyDate: null,
    additionalFieldValues: {},
    photos: initialPhotos || [],
    currentStep: initialCategory ? "priority" : "category",
    waitingForInput: false,
    inputField: null,
    createdAt: new Date(),
  });

  return session;
}

export async function getWizardSession(botMessageId: number): Promise<IWizardSession | null> {
  return await WizardSession.findOne({ botMessageId }).lean ? await WizardSession.findOne({ botMessageId }) : null;
}

export async function updateWizardSession(
  botMessageId: number,
  updates: Partial<IWizardSession>
): Promise<IWizardSession | null> {
  return await WizardSession.findOneAndUpdate({ botMessageId }, { $set: updates }, { new: true });
}

export async function deleteWizardSession(botMessageId: number): Promise<void> {
  await WizardSession.deleteOne({ botMessageId });
}

/** --- Flow resolver & completion check --- */

/**
 * Determine whether wizard is complete based on WorkflowRule for the category and session fields.
 */
export async function isWizardComplete(session: IWizardSession): Promise<boolean> {
  if (!session.category || !session.priority) return false;

  // get workflow rule for category (if any)
  try {
    const rule = await WorkflowRule.findOne({ categoryId: session.category }).lean();
    if (!rule) {
      // default behaviour: require at least a location or customLocation
      const hasLocation = session.locationComplete || !!session.customLocation;
      return hasLocation;
    }

    // Check subcategory
    if (rule.hasSubcategories) {
      if (!session.subCategoryId) return false;
    }

    // Location checks
    if (rule.requiresSourceLocation) {
      if (!session.sourceLocationComplete && !session.customLocation) return false;
    }

    if (rule.requiresTargetLocation) {
      if (!session.targetLocationComplete && !session.customLocation) return false;
    }

    if (rule.requiresLocation && !rule.requiresSourceLocation && !rule.requiresTargetLocation) {
      // require main location
      if (!session.locationComplete && !session.customLocation) return false;
    }

    // Agency checks
    if (rule.requiresAgency) {
      if (session.agencyRequired === null || session.agencyRequired === undefined) return false;
      if (session.agencyRequired && rule.requiresAgencyDate) {
        if (!session.agencyDate) return false;
      }
    }

    // Additional fields
    if (rule.additionalFields && rule.additionalFields.length > 0) {
      for (const field of rule.additionalFields) {
        if (!session.additionalFieldValues || session.additionalFieldValues[field.key] === undefined || session.additionalFieldValues[field.key] === null || session.additionalFieldValues[field.key] === "") {
          return false;
        }
      }
    }

    return true;
  } catch (err) {
    // If rule lookup fails, fallback to simple checks
    const hasLocation = session.locationComplete || !!session.customLocation;
    return hasLocation;
  }
}

/**
 * Decide the next step for a session.
 * Returns a string key for the step; used by the webhook to show the appropriate keyboard/prompt.
 */
export async function resolveNextStep(session: IWizardSession): Promise<string> {
  // Priority must be next if category chosen but priority not set
  if (!session.category) return "category";

  if (!session.priority) return "priority";

  // get workflow rule
  const rule = await WorkflowRule.findOne({ categoryId: session.category }).lean();

  // subcategory step
  if (rule && rule.hasSubcategories && !session.subCategoryId) {
    return "subcategory";
  }

  // transfer source/target checks
  if (rule && rule.requiresSourceLocation && !session.sourceLocationComplete) {
    return "source_location";
  }

  if (rule && rule.requiresTargetLocation && !session.targetLocationComplete) {
    return "target_location";
  }

  // general location
  if (rule && rule.requiresLocation && !rule.requiresSourceLocation && !rule.requiresTargetLocation && !session.locationComplete && !session.customLocation) {
    return "location";
  }

  // agency
  if (rule && rule.requiresAgency && (session.agencyRequired === null || session.agencyRequired === undefined)) {
    return "agency";
  }

  if (rule && rule.requiresAgency && session.agencyRequired && rule.requiresAgencyDate && !session.agencyDate) {
    return "agency_date";
  }

  // additional fields
  if (rule && rule.additionalFields && rule.additionalFields.length > 0) {
    for (const field of rule.additionalFields) {
      if (!session.additionalFieldValues || session.additionalFieldValues[field.key] === undefined || session.additionalFieldValues[field.key] === null || session.additionalFieldValues[field.key] === "") {
        return "additional_fields";
      }
    }
  }

  // everything looks filled — complete
  return "complete";
}

/** --- Formatting helpers --- */

export function formatWizardMessage(session: IWizardSession): string {
  // Category display
  const categoryDisplay = session.category ? toDisplayName(session.category) : "—";
  const subCategoryDisplay = session.subCategoryId ? session.subCategoryId : "—"; // we'll show name when possible in webhook by populating session

  const priorityText = session.priority ? session.priority.toUpperCase() : "—";

  // Locations
  const mainLocation = session.customLocation ? session.customLocation : locationPathToString(session.locationPath);
  const sourceLocation = session.sourceLocationPath && session.sourceLocationPath.length > 0 ? locationPathToString(session.sourceLocationPath) : "—";
  const targetLocation = session.targetLocationPath && session.targetLocationPath.length > 0 ? locationPathToString(session.targetLocationPath) : "—";

  const agencyText = session.agencyRequired === null || session.agencyRequired === undefined ? "—" : session.agencyRequired ? `Yes${session.agencyDate ? ` (by ${session.agencyDate.toISOString().split("T")[0]})` : ""}` : "No";

  const additionalLines: string[] = [];
  if (session.additionalFieldValues) {
    for (const k of Object.keys(session.additionalFieldValues)) {
      additionalLines.push(`<b>${k}:</b> ${session.additionalFieldValues[k]}`);
    }
  }

  const photosText = session.photos && session.photos.length > 0 ? `📸 <b>Photos:</b> ${session.photos.length} attached` : "📸 <b>Photos:</b> None (Send an image to attach)";

  return [
    `🛠 <b>Ticket Wizard</b>`,
    `📝 Issue: ${session.originalText}`,
    ``,
    `<b>Category:</b> ${categoryDisplay}`,
    `<b>Subcategory:</b> ${subCategoryDisplay}`,
    `<b>Priority:</b> ${priorityText}`,
    `<b>Location:</b> ${mainLocation}`,
    `<b>From:</b> ${sourceLocation}`,
    `<b>To:</b> ${targetLocation}`,
    `<b>Agency:</b> ${agencyText}`,
    additionalLines.length ? additionalLines.join("\n") : "",
    photosText,
    ``,
    (session.currentStep === "complete") ? "✅ All information complete!" : "⚠️ Please complete the selections below:"
  ].filter(Boolean).join("\n");
}

/** --- Keyboard builders --- */

/** Build category keyboard dynamically from DB */
export async function buildCategoryKeyboard(botMessageId: number): Promise<any[]> {
  const cats = await Category.find({ isActive: true }).sort({ priority: -1, name: 1 }).lean();
  const rows: any[] = [];

  // Build in two-column rows
  for (let i = 0; i < cats.length; i += 2) {
    const left = cats[i];
    const right = cats[i + 1];
    const row: any[] = [];

    row.push({ text: `${left.icon || "📋"} ${left.displayName}`, callback_data: `cat_${botMessageId}_${left._id}` });
    if (right) row.push({ text: `${right.icon || "📋"} ${right.displayName}`, callback_data: `cat_${botMessageId}_${right._id}` });

    rows.push(row);
  }

  // Manual entry removed to enforce Masters data usage
  // rows.push([{ text: "📋 Other (Manual Entry)", callback_data: `cat_${botMessageId}_manual` }]);
  return rows;
}

/** Build subcategory keyboard for a category */
export async function buildSubCategoryKeyboard(botMessageId: number, categoryId: string | null): Promise<any[]> {
  if (!categoryId) {
    return [[{ text: "⬅️ Back", callback_data: `step_${botMessageId}_category` }]];
  }
  const subs = await SubCategory.find({ categoryId, isActive: true }).sort({ name: 1 }).lean();
  if (!subs || subs.length === 0) {
    // If no subcategories, maybe auto-skip or show back? 
    // For now, just show Back.
    return [[{ text: "⬅️ Back", callback_data: `step_${botMessageId}_category` }]];
  }

  const rows: any[] = [];
  for (let i = 0; i < subs.length; i += 2) {
    const left = subs[i];
    const right = subs[i + 1];
    const row: any[] = [];
    row.push({ text: `${left.icon || ""} ${left.name}`, callback_data: `sub_${botMessageId}_${left._id}` });
    if (right) row.push({ text: `${right.icon || ""} ${right.name}`, callback_data: `sub_${botMessageId}_${right._id}` });
    rows.push(row);
  }

  // Manual entry removed
  rows.push([{ text: "⬅️ Back", callback_data: `step_${botMessageId}_category` }]);
  return rows;
}

/** Priority keyboard (static) */
export function buildPriorityKeyboard(botMessageId: number): any[] {
  return [
    [
      { text: "🔴 High", callback_data: `pri_${botMessageId}_high` },
      { text: "🟡 Medium", callback_data: `pri_${botMessageId}_medium` },
      { text: "🟢 Low", callback_data: `pri_${botMessageId}_low` },
    ],
    [{ text: "⬅️ Back", callback_data: `step_${botMessageId}_category` }],
  ];
}

/**
 * Build dynamic location keyboard:
 * - parentId null => show top-level locations
 * - otherwise show children of parentId
 *
 * callback_data: loc_<botMessageId>_child_<locationId>
 * special manual: loc_<botMessageId>_manual
 * back: loc_<botMessageId>_back_<parentIdOrROOT>
 */
export async function buildLocationChildrenKeyboard(botMessageId: number, parentLocationId: string | null): Promise<any[]> {
  const query: any = parentLocationId ? { parentLocationId } : { parentLocationId: null };
  const children = await Location.find(query).sort({ name: 1 }).lean();

  const rows: any[] = [];
  for (let i = 0; i < children.length; i += 2) {
    const left = children[i];
    const right = children[i + 1];
    const row: any[] = [];
    row.push({ text: `${left.name}`, callback_data: `loc_${botMessageId}_child_${left._id}` });
    if (right) row.push({ text: `${right.name}`, callback_data: `loc_${botMessageId}_child_${right._id}` });
    rows.push(row);
  }

  // Manual entry removed
  const backPayload = parentLocationId ? `loc_${botMessageId}_back_${parentLocationId}` : `loc_${botMessageId}_back_root`;
  // rows.push([{ text: "✍️ Manual Entry", callback_data: `loc_${botMessageId}_manual` }]);
  rows.push([{ text: "⬅️ Back", callback_data: backPayload }]);

  return rows;
}

/** Agency Yes/No keyboard */
export function buildAgencyKeyboard(botMessageId: number): any[] {
  return [
    [{ text: "✅ Yes (Agency will do)", callback_data: `agency_${botMessageId}_yes` }],
    [{ text: "❌ No (We will do)", callback_data: `agency_${botMessageId}_no` }],
    [{ text: "⬅️ Back", callback_data: `step_${botMessageId}_location` }],
  ];
}

/** Additional fields: these are usually input fields; we show a "Provide" button which sets waitingForInput */
export function buildAdditionalFieldsKeyboard(botMessageId: number, fields: { key: string; label: string; type: string }[]): any[] {
  const rows: any[] = [];
  for (const f of fields) {
    rows.push([{ text: `✍️ ${f.label}`, callback_data: `field_${botMessageId}_${f.key}` }]);
  }
  rows.push([{ text: "⬅️ Back", callback_data: `step_${botMessageId}_agency` }]);
  return rows;
}

/** Build final wizard keyboard based on current step and isComplete */
export async function buildWizardKeyboard(session: IWizardSession): Promise<any[]> {
  const keyboard: any[] = [];

  // category
  keyboard.push([{ text: session.category ? "📂 Change Category" : "📂 Select Category", callback_data: `step_${session.botMessageId}_category` }]);

  // subcategory (if category has subcats)
  const rule = session.category ? await WorkflowRule.findOne({ categoryId: session.category }).lean() : null;
  if (rule && rule.hasSubcategories) {
    keyboard.push([{ text: session.subCategoryId ? "🧩 Change Subcategory" : "🧩 Select Subcategory", callback_data: `step_${session.botMessageId}_subcategory` }]);
  }

  // priority
  keyboard.push([{ text: session.priority ? "⚡ Change Priority" : "⚡ Select Priority", callback_data: `step_${session.botMessageId}_priority` }]);

  // location(s)
  if (rule && rule.requiresSourceLocation) {
    keyboard.push([{ text: session.sourceLocationComplete ? "📍 Change From (Source)" : "📍 Select From (Source)", callback_data: `step_${session.botMessageId}_source_location` }]);
  }
  if (rule && rule.requiresTargetLocation) {
    keyboard.push([{ text: session.targetLocationComplete ? "📍 Change To (Target)" : "📍 Select To (Target)", callback_data: `step_${session.botMessageId}_target_location` }]);
  }
  if (rule && rule.requiresLocation && !rule.requiresSourceLocation && !rule.requiresTargetLocation) {
    keyboard.push([{ text: session.locationComplete || session.customLocation ? "📍 Change Location" : "📍 Select Location", callback_data: `step_${session.botMessageId}_location` }]);
  }

  // agency
  if (rule && rule.requiresAgency) {
    keyboard.push([{ text: session.agencyRequired === null ? "🧾 Agency?" : `🧾 Agency: ${session.agencyRequired ? "Yes" : "No"}`, callback_data: `step_${session.botMessageId}_agency` }]);
  }

  // additional fields
  if (rule && rule.additionalFields && rule.additionalFields.length > 0) {
    keyboard.push([{ text: "📝 Additional Details", callback_data: `step_${session.botMessageId}_additional_fields` }]);
  }

  // create ticket if complete
  const complete = await isWizardComplete(session);
  if (complete) {
    keyboard.push([{ text: "✅ Create Ticket", callback_data: `submit_${session.botMessageId}` }]);
  }

  return keyboard;
}

/** --- Ticket creation --- */

export async function createTicketFromWizard(session: IWizardSession, createdBy: string): Promise<any> {
  const ticketId = await generateTicketId();

  // Resolve names for category / subcategory
  let categoryName = session.category;
  let categoryDisplay = session.category;
  try {
    if (session.category) {
      const cat = await Category.findById(session.category).lean();
      if (cat) {
        categoryName = cat.name;
        categoryDisplay = cat.displayName;
      }
    }
  } catch (err) {}

  let subCategoryName = null;
  if (session.subCategoryId) {
    try {
      const sub = await SubCategory.findById(session.subCategoryId).lean();
      if (sub) subCategoryName = sub.name;
    } catch (err) {}
  }

  // Location string assembly (depends on workflow)
  const rule = session.category ? await WorkflowRule.findOne({ categoryId: session.category }).lean() : null;

  let locationString = session.customLocation || (session.locationPath && session.locationPath.length ? locationPathToString(session.locationPath) : "");
  let sourceString = session.sourceLocationPath && session.sourceLocationPath.length ? locationPathToString(session.sourceLocationPath) : null;
  let targetString = session.targetLocationPath && session.targetLocationPath.length ? locationPathToString(session.targetLocationPath) : null;

  // For tickets, create a consolidated location field (human readable)
  let finalLocationText = "";
  if (rule && rule.requiresSourceLocation && rule.requiresTargetLocation) {
    finalLocationText = `From: ${sourceString || "—"} | To: ${targetString || "—"}`;
  } else if (rule && rule.requiresSourceLocation) {
    finalLocationText = `From: ${sourceString || "—"}`;
  } else if (rule && rule.requiresTargetLocation) {
    finalLocationText = `To: ${targetString || "—"}`;
  } else {
    finalLocationText = locationString || "—";
  }

  // Additional field values
  const additional = session.additionalFieldValues || {};

  const ticketPayload: any = {
    ticketId,
    description: session.originalText,
    category: categoryName,
    categoryDisplay,
    subCategory: subCategoryName,
    priority: session.priority,
    location: finalLocationText,
    photos: session.photos || [],
    createdBy,
    createdAt: new Date(),
    status: "PENDING",
    telegramMessageId: session.botMessageId,
    telegramChatId: session.chatId,
    // dynamic extras
    meta: {
      locationPath: session.locationPath || [],
      sourceLocationPath: session.sourceLocationPath || [],
      targetLocationPath: session.targetLocationPath || [],
      customLocation: session.customLocation || null,
      agencyRequired: session.agencyRequired || false,
      agencyDate: session.agencyDate || null,
      additionalFieldValues: additional,
    },
  };

  const ticket = await Ticket.create(ticketPayload);
  return ticket;
}

/** --- UI update helper --- */

export async function updateWizardUI(sessionOrId: IWizardSession | number): Promise<void> {
  let session: IWizardSession | null = null;
  if (typeof sessionOrId === "number") {
    session = await WizardSession.findOne({ botMessageId: sessionOrId });
  } else {
    session = sessionOrId as IWizardSession;
  }

  if (!session) return;

  // Refresh dynamic keyboard
  const keyboard = await buildWizardKeyboard(session as IWizardSession);
  const message = formatWizardMessage(session as IWizardSession);
  await editMessageText(session.chatId, session.botMessageId, message, keyboard);
}

/** --- Location traversal helpers used from webhook --- */

/**
 * Add a picked location node to a path array.
 * parentPath = existing path array
 * picked = { id, name }
 * returns new path
 */
export function appendLocationNodeToPath(parentPath: { id: string; name: string }[], picked: { id: string; name: string }) {
  const newPath = parentPath ? [...parentPath] : [];
  newPath.push(picked);
  return newPath;
}

/** --- Export default (utils) --- */
export default {
  createWizardSession,
  getWizardSession,
  updateWizardSession,
  deleteWizardSession,
  isWizardComplete,
  formatWizardMessage,
  buildCategoryKeyboard,
  buildSubCategoryKeyboard,
  buildPriorityKeyboard,
  buildLocationChildrenKeyboard,
  buildAgencyKeyboard,
  buildAdditionalFieldsKeyboard,
  buildWizardKeyboard,
  createTicketFromWizard,
  updateWizardUI,
  resolveNextStep,
  appendLocationNodeToPath,
};
