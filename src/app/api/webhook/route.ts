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
} from "@/lib/telegram";

import {
  createWizardSession,
  getWizardSession,
  updateWizardSession,
  deleteWizardSession,
  isWizardComplete,
  // formatWizardMessage, // Replaced by local enhanced version
  buildWizardKeyboard,
  buildCategoryKeyboard,
  buildSubCategoryKeyboard,
  buildPriorityKeyboard,
  buildLocationChildrenKeyboard,
  buildAgencyKeyboard,
  buildAdditionalFieldsKeyboard,
  createTicketFromWizard,
  updateWizardUI,
  resolveNextStep,
  appendLocationNodeToPath,
} from "@/lib/wizardHelpers";

/**
 * Telegram update shape (partial)
 */
interface TelegramUpdate {
  update_id?: number;
  message?: any;
  edited_message?: any;
  callback_query?: any;
}

/** Prefer caption (for photos), fallback to text */
function extractTextFromMessage(msg: any): string {
  if (!msg) return "";
  if (typeof msg.caption === "string" && msg.caption.trim().length)
    return msg.caption.trim();
  if (typeof msg.text === "string" && msg.text.trim().length)
    return msg.text.trim();
  return "";
}

/**
 * Generates the enhanced UI message string for Telegram
 * Matches the "Expanded Wizard Preview" design:
 * - Header
 * - Completed Fields (with checkmarks)
 * - Divider
 * - (The Active Section Prompt is appended by the caller)
 */
async function formatEnhancedWizardMessage(session: any): Promise<string> {
  const { description } = session;
  
  // 1. Header
  let text = `🛠 <b>Ticket Wizard</b>\n📝 <b>Issue:</b> ${description || "No description"}`;

  // 2. Completed Fields Section
  const completed: string[] = [];

  // -- Category
  if (session.category) {
    let catDisplay = session.category;
    // Attempt to resolve name if it looks like a MongoDB ObjectId
    if (typeof catDisplay === 'string' && catDisplay.match(/^[0-9a-fA-F]{24}$/)) {
      try {
        const c = await Category.findById(catDisplay).lean();
        if (c) catDisplay = c.displayName || c.name;
      } catch (e) {}
    }
    // Capitalize or format if needed
    completed.push(`Category: <b>${catDisplay}</b>`);
  }

  // -- Priority
  if (session.priority) {
    const pMap: Record<string, string> = { 
      low: "🟢 LOW", 
      medium: "🟡 MEDIUM", 
      high: "🔴 HIGH" 
    };
    completed.push(`Priority: <b>${pMap[session.priority] || session.priority}</b>`);
  }

  // -- Subcategory
  if (session.subCategoryId) {
    try {
      const s = await SubCategory.findById(session.subCategoryId).lean();
      if (s) completed.push(`Subcategory: <b>${s.name}</b>`);
    } catch (e) {}
  }

  // -- Location
  if (session.locationComplete || session.customLocation) {
    if (session.customLocation) {
      completed.push(`Location: <b>${session.customLocation}</b>`);
    } else if (session.locationPath && session.locationPath.length > 0) {
      const pathStr = session.locationPath.map((n: any) => n.name).join(" › ");
      completed.push(`Location: <b>${pathStr}</b>`);
    }
  }

  // -- Source/Target (if applicable)
  if (session.sourceLocationComplete && session.sourceLocationPath?.length) {
    const pathStr = session.sourceLocationPath.map((n: any) => n.name).join(" › ");
    completed.push(`Source: <b>${pathStr}</b>`);
  }
  if (session.targetLocationComplete && session.targetLocationPath?.length) {
    const pathStr = session.targetLocationPath.map((n: any) => n.name).join(" › ");
    completed.push(`Target: <b>${pathStr}</b>`);
  }

  // -- Agency
  if (session.agencyRequired === true) {
    completed.push(`Agency: <b>Yes</b>`);
    if (session.agencyDate) {
      try {
        const d = new Date(session.agencyDate);
        completed.push(`Agency Date: <b>${d.toISOString().split('T')[0]}</b>`);
      } catch (e) {}
    }
  } else if (session.agencyRequired === false) {
    completed.push(`Agency: <b>No</b>`);
  }

  // -- Additional Fields
  if (session.additionalFieldValues) {
    for(const k in session.additionalFieldValues) {
      completed.push(`${k}: <b>${session.additionalFieldValues[k]}</b>`);
    }
  }

  // -- Render Completed Section
  if (completed.length > 0) {
    text += `\n\n━━━━━━━━━━━━━━━━\n✅ <b>COMPLETED FIELDS</b>\n`;
    text += completed.map(line => `• ${line} ✅`).join("\n");
  }

  return text;
}

/**
 * Helper: show a step UI based on the resolved step key
 * - session: the up-to-date session mongoose doc (not lean)
 * - chatId, messageId: where to edit the wizard message
 */
async function showStepUI(session: any, chatId: number, messageId: number) {
  const next = await resolveNextStep(session);
  session.currentStep = next;
  // Ensure session is saved with new step
  await session.save?.() ?? await updateWizardSession(session.botMessageId, { currentStep: next });

  // Generate the base message with completed fields
  const baseMessage = await formatEnhancedWizardMessage(session);
  
  // Common Divider for the Active Section
  const sectionDivider = `\n\n━━━━━━━━━━━━━━━━\n`;

  if (next === "category") {
    const keyboard = await buildCategoryKeyboard(session.botMessageId);
    const prompt = `${sectionDivider}⬇️ <b>CATEGORY</b> (Select One)`;
    await editMessageText(chatId, messageId, baseMessage + prompt, keyboard);
    return;
  }

  if (next === "priority") {
    const keyboard = buildPriorityKeyboard(session.botMessageId);
    const prompt = `${sectionDivider}⬇️ <b>PRIORITY</b> (Select One)`;
    await editMessageText(chatId, messageId, baseMessage + prompt, keyboard);
    return;
  }

  if (next === "subcategory") {
    // session.category contains categoryId (string)
    const keyboard = await buildSubCategoryKeyboard(session.botMessageId, session.category);
    const prompt = `${sectionDivider}⬇️ <b>SUBCATEGORY</b> (Select One)`;
    await editMessageText(chatId, messageId, baseMessage + prompt, keyboard);
    return;
  }

  if (next === "location") {
    const keyboard = await buildLocationChildrenKeyboard(session.botMessageId, null);
    const prompt = `${sectionDivider}⬇️ <b>LOCATION</b> (Select One)`;
    await editMessageText(chatId, messageId, baseMessage + prompt, keyboard);
    return;
  }

  if (next === "source_location") {
    const keyboard = await buildLocationChildrenKeyboard(session.botMessageId, null);
    const prompt = `${sectionDivider}⬇️ <b>SOURCE LOCATION</b> (From)`;
    await editMessageText(chatId, messageId, baseMessage + prompt, keyboard);
    return;
  }

  if (next === "target_location") {
    const keyboard = await buildLocationChildrenKeyboard(session.botMessageId, null);
    const prompt = `${sectionDivider}⬇️ <b>TARGET LOCATION</b> (To)`;
    await editMessageText(chatId, messageId, baseMessage + prompt, keyboard);
    return;
  }

  if (next === "agency") {
    const keyboard = buildAgencyKeyboard(session.botMessageId);
    const prompt = `${sectionDivider}⬇️ <b>AGENCY REQUIRED?</b>`;
    await editMessageText(chatId, messageId, baseMessage + prompt, keyboard);
    return;
  }

  if (next === "agency_date") {
    const prompt = `${sectionDivider}⬇️ <b>AGENCY DATE</b>\n📅 Please type the agency date (YYYY-MM-DD):`;
    await editMessageText(chatId, messageId, baseMessage + prompt, []);
    await updateWizardSession(session.botMessageId, { waitingForInput: true, inputField: "agency_date" });
    return;
  }

  if (next === "additional_fields") {
    const rule = await WorkflowRule.findOne({ categoryId: session.category }).lean();
    const fields = rule?.additionalFields || [];
    const keyboard = buildAdditionalFieldsKeyboard(session.botMessageId, fields);
    const prompt = `${sectionDivider}⬇️ <b>ADDITIONAL DETAILS</b>`;
    await editMessageText(chatId, messageId, baseMessage + prompt, keyboard);
    return;
  }

  if (next === "complete") {
    // Show final keyboard (create ticket)
    const keyboard = await buildWizardKeyboard(session);
    const prompt = `${sectionDivider}✅ <b>ALL SET!</b>\nReview details above and click Submit.`;
    await editMessageText(chatId, messageId, baseMessage + prompt, keyboard);
    return;
  }

  // Fallback
  const keyboard = await buildWizardKeyboard(session);
  await editMessageText(chatId, messageId, baseMessage, keyboard);
}

/**
 * Handle loc child click:
 * - append node to relevant path (location / source / target depending on session.currentStep)
 * - check if this location node has children; if yes show children of picked node
 * - if no children: mark pathComplete for that kind and move to next step
 */
async function handleLocationChildClick(session: any, chatId: number, messageId: number, pickedLocationId: string, callbackQueryId: string) {
  const picked = await Location.findById(pickedLocationId).lean();
  if (!picked) {
    await answerCallbackQuery(callbackQueryId, "Location not found.");
    return;
  }

  const step = session.currentStep || (await resolveNextStep(session));
  let pathField = "locationPath";
  let completeField = "locationComplete";
  
  if (step === "source_location") {
    pathField = "sourceLocationPath";
    completeField = "sourceLocationComplete";
  } else if (step === "target_location") {
    pathField = "targetLocationPath";
    completeField = "targetLocationComplete";
  }

  const node = { id: String(picked._id), name: picked.name };
  const currentPath = (session as any)[pathField] || [];
  const newPath = appendLocationNodeToPath(currentPath, node);

  const childrenCount = await Location.countDocuments({ parentLocationId: picked._id });

  if (childrenCount && childrenCount > 0) {
    // update session: set path and selectedLocationId
    await updateWizardSession(session.botMessageId, {
      [pathField]: newPath,
      selectedLocationId: String(picked._id),
    });
    const updatedSession = await getWizardSession(session.botMessageId);
    
    // Show children of this node
    const keyboard = await buildLocationChildrenKeyboard(session.botMessageId, String(picked._id));
    const baseMessage = await formatEnhancedWizardMessage(updatedSession as any);
    const prompt = `\n\n━━━━━━━━━━━━━━━━\n⬇️ <b>LOCATION: ${picked.name}</b>\nSelect specific area:`;
    
    await editMessageText(chatId, messageId, baseMessage + prompt, keyboard);
    await answerCallbackQuery(callbackQueryId, "");
    return;
  } else {
    // leaf node: mark complete
    await updateWizardSession(session.botMessageId, {
      [pathField]: newPath,
      [completeField]: true,
    });
    const updatedSession = await getWizardSession(session.botMessageId);
    // Move to next step
    await showStepUI(updatedSession, chatId, messageId);
    await answerCallbackQuery(callbackQueryId, `Selected: ${picked.name}`);
    return;
  }
}

/**
 * Entry point
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TelegramUpdate;
    await connectToDB();

    // ---------- CALLBACK QUERY HANDLING ----------
    if (body.callback_query) {
      const callback = body.callback_query;
      const data: string = callback.data;
      const messageId: number | undefined = callback.message?.message_id;
      const chatId: number | undefined = callback.message?.chat?.id;

      if (!data || !messageId || !chatId) {
        return NextResponse.json({ ok: true });
      }

      const parts = data.split("_");
      const action = parts[0];

      const session = await getWizardSession(messageId);
      if (!session) {
        await answerCallbackQuery(callback.id, "Session expired. Please create a new ticket.");
        return NextResponse.json({ ok: true });
      }

      // === CATEGORY selection ===
      if (action === "cat") {
        const categoryId = parts.slice(2).join("_");
        if (categoryId === "manual") {
          await answerCallbackQuery(callback.id, "Manual entry is disabled. Please select from the list.");
          return NextResponse.json({ ok: true });
        } else {
          await updateWizardSession(session.botMessageId, {
            category: categoryId,
            subCategoryId: null, // reset
          });
          const updated = await getWizardSession(session.botMessageId);
          await showStepUI(updated, chatId, messageId);
          await answerCallbackQuery(callback.id, "Category selected.");
          return NextResponse.json({ ok: true });
        }
      }

      // === SUBCATEGORY selection ===
      if (action === "sub") {
        const subId = parts.slice(2).join("_");
        if (subId === "manual") {
          await answerCallbackQuery(callback.id, "Manual entry is disabled.");
          return NextResponse.json({ ok: true });
        } else {
          await updateWizardSession(session.botMessageId, { subCategoryId: subId });
          const updated = await getWizardSession(session.botMessageId);
          await showStepUI(updated, chatId, messageId);
          await answerCallbackQuery(callback.id, "Subcategory selected.");
          return NextResponse.json({ ok: true });
        }
      }

      // === PRIORITY ===
      if (action === "pri") {
        const priority = parts[2] as "low" | "medium" | "high";
        await updateWizardSession(session.botMessageId, { priority });
        const updated = await getWizardSession(session.botMessageId);
        await showStepUI(updated, chatId, messageId);
        await answerCallbackQuery(callback.id, `Priority set to ${priority}`);
        return NextResponse.json({ ok: true });
      }

      // === LOCATION tree actions ===
      if (action === "loc") {
        const subact = parts[2];
        if (subact === "child") {
          const pickedLocationId = parts.slice(3).join("_");
          await handleLocationChildClick(session, chatId, messageId, pickedLocationId, callback.id);
          return NextResponse.json({ ok: true });
        } else if (subact === "back") {
          const backId = parts.slice(3).join("_");
          const parentId = backId === "root" ? null : backId;
          const keyboard = await buildLocationChildrenKeyboard(session.botMessageId, parentId);
          
          // Re-render with new format
          const updatedSession = await getWizardSession(session.botMessageId);
          const baseMessage = await formatEnhancedWizardMessage(updatedSession as any);
          const prompt = `\n\n━━━━━━━━━━━━━━━━\n⬇️ <b>LOCATION</b>\nSelect Location:`;
          
          await editMessageText(chatId, messageId, baseMessage + prompt, keyboard);
          await answerCallbackQuery(callback.id);
          return NextResponse.json({ ok: true });
        } else if (subact === "manual") {
          await answerCallbackQuery(callback.id, "Manual entry is disabled.");
          return NextResponse.json({ ok: true });
        }
      }

      // === AGENCY ===
      if (action === "agency") {
        const val = parts[2];
        if (val === "yes") {
          await updateWizardSession(session.botMessageId, { agencyRequired: true });
          const rule = await WorkflowRule.findOne({ categoryId: session.category }).lean();
          if (rule && rule.requiresAgencyDate) {
            // ask for date
            await updateWizardSession(session.botMessageId, { waitingForInput: true, inputField: "agency_date" });
            const updated = await getWizardSession(session.botMessageId);
            const baseMessage = await formatEnhancedWizardMessage(updated as any);
            const prompt = `\n\n━━━━━━━━━━━━━━━━\n⬇️ <b>AGENCY DATE</b>\n📅 Please type the agency date (YYYY-MM-DD):`;
            
            await editMessageText(chatId, messageId, baseMessage + prompt, []);
            await answerCallbackQuery(callback.id, "Please provide agency date.");
            return NextResponse.json({ ok: true });
          } else {
            const updated = await getWizardSession(session.botMessageId);
            await showStepUI(updated, chatId, messageId);
            await answerCallbackQuery(callback.id, "Agency: Yes");
            return NextResponse.json({ ok: true });
          }
        } else {
          await updateWizardSession(session.botMessageId, { agencyRequired: false, agencyDate: null });
          const updated = await getWizardSession(session.botMessageId);
          await showStepUI(updated, chatId, messageId);
          await answerCallbackQuery(callback.id, "Agency: No");
          return NextResponse.json({ ok: true });
        }
      }

      // === ADDITIONAL FIELD BUTTON ===
      if (action === "field") {
        const fieldKey = parts.slice(2).join("_");
        await updateWizardSession(session.botMessageId, { waitingForInput: true, inputField: `field:${fieldKey}` });
        const updated = await getWizardSession(session.botMessageId);
        const baseMessage = await formatEnhancedWizardMessage(updated as any);
        const prompt = `\n\n━━━━━━━━━━━━━━━━\n⬇️ <b>${fieldKey.toUpperCase()}</b>\n✍️ Please type value:`;
        
        await editMessageText(chatId, messageId, baseMessage + prompt, []);
        await answerCallbackQuery(callback.id, `Provide ${fieldKey}`);
        return NextResponse.json({ ok: true });
      }

      // === STEP navigation ===
      if (action === "step") {
        const stepName = parts.slice(2).join("_");
        const baseMessage = await formatEnhancedWizardMessage(session);
        const divider = `\n\n━━━━━━━━━━━━━━━━\n`;
        
        if (stepName === "category") {
          const keyboard = await buildCategoryKeyboard(session.botMessageId);
          await editMessageText(chatId, messageId, baseMessage + divider + "⬇️ <b>CATEGORY</b>", keyboard);
        } else if (stepName === "priority") {
          const keyboard = buildPriorityKeyboard(session.botMessageId);
          await editMessageText(chatId, messageId, baseMessage + divider + "⬇️ <b>PRIORITY</b>", keyboard);
        } else if (stepName === "location") {
          const keyboard = await buildLocationChildrenKeyboard(session.botMessageId, null);
          await editMessageText(chatId, messageId, baseMessage + divider + "⬇️ <b>LOCATION</b>", keyboard);
        } else if (stepName === "subcategory") {
          const keyboard = await buildSubCategoryKeyboard(session.botMessageId, session.category);
          await editMessageText(chatId, messageId, baseMessage + divider + "⬇️ <b>SUBCATEGORY</b>", keyboard);
        } else if (stepName === "agency") {
          const keyboard = buildAgencyKeyboard(session.botMessageId);
          await editMessageText(chatId, messageId, baseMessage + divider + "⬇️ <b>AGENCY</b>", keyboard);
        } else if (stepName === "additional_fields") {
          const rule = await WorkflowRule.findOne({ categoryId: session.category }).lean();
          const keyboard = buildAdditionalFieldsKeyboard(session.botMessageId, rule?.additionalFields || []);
          await editMessageText(chatId, messageId, baseMessage + divider + "⬇️ <b>ADDITIONAL FIELDS</b>", keyboard);
        }
        await answerCallbackQuery(callback.id);
        return NextResponse.json({ ok: true });
      }

      // === SUBMIT ===
      if (action === "submit") {
        const fresh = await getWizardSession(session.botMessageId);
        const complete = await isWizardComplete(fresh as any);
        if (!complete) {
          await answerCallbackQuery(callback.id, "Please complete all required fields first.", true);
          return NextResponse.json({ ok: true });
        }

        const createdBy =
          callback.from?.username ||
          `${callback.from?.first_name || ""} ${callback.from?.last_name || ""}`.trim();

        const ticket = await createTicketFromWizard(fresh as any, createdBy);

        const categoryText = ticket.categoryDisplay || ticket.category || "—";
        const ticketMsg = `🎫 <b>Ticket ${ticket.ticketId} Created</b>\n📝 ${ticket.description}\n\n<b>Category:</b> ${categoryText}\n<b>Priority:</b> ${ticket.priority}\n<b>Location:</b> ${ticket.location}\n<b>Created by:</b> ${createdBy}`;
        try {
          await telegramSendMessage(chatId, ticketMsg);
        } catch (err) {
          console.error("Failed to send ticket message:", err);
        }

        await deleteWizardSession(session.botMessageId);
        await answerCallbackQuery(callback.id, "Ticket created successfully!");
        return NextResponse.json({ ok: true });
      }

      await answerCallbackQuery(callback.id, "Action not recognized.");
      return NextResponse.json({ ok: true });
    }

    // ---------- NORMAL MESSAGES (non-callback) ----------
    const msg = body.message || body.edited_message;
    if (!msg) return NextResponse.json({ ok: true });
    if (msg.from?.is_bot) return NextResponse.json({ ok: true });

    const chat = msg.chat;
    if (chat?.type !== "group" && chat?.type !== "supergroup") return NextResponse.json({ ok: true });

    // User tracking
    if (msg.from && !msg.from.is_bot) {
      try {
        const { upsertUser } = await import("@/services/syncService");
        await upsertUser(
          {
            id: msg.from.id,
            username: msg.from.username,
            first_name: msg.from.first_name,
            last_name: msg.from.last_name,
            is_bot: msg.from.is_bot,
            language_code: msg.from.language_code,
          },
          "webhook",
          chat.id
        );
      } catch (err) {
        console.error("Failed to track user from webhook:", err);
      }
    }

    const incomingText = (msg.text || msg.caption || "").toString().trim();

    // --- CANCEL ---
    if (incomingText && (incomingText.toLowerCase() === "/cancel" || incomingText.toLowerCase() === "cancel")) {
      const latest = await WizardSession.findOne({ userId: msg.from.id }).sort({ createdAt: -1 });
      if (latest) {
        await deleteWizardSession(latest.botMessageId);
        try {
          await telegramSendMessage(chat.id, `❌ Wizard cancelled (botMessageId=${latest.botMessageId})`);
        } catch (err) {}
      } else {
        try {
          await telegramSendMessage(chat.id, "No active wizard found to cancel.");
        } catch (err) {}
      }
      return NextResponse.json({ ok: true });
    }

    // --- Handle waitingForInput ---
    const activeSession = await WizardSession.findOne({ userId: msg.from.id, waitingForInput: true }).sort({ createdAt: -1 });

    // Photo upload logic
    let uploadedPhotoUrl: string | null = null;
    try {
      if (msg.photo || msg.document) {
        const { downloadTelegramFileBuffer } = await import("@/lib/downloadTelegramFileBuffer");
        const { uploadBufferToCloudinary } = await import("@/lib/uploadBufferToCloudinary");
        const fileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : msg.document?.file_id;
        if (fileId) {
          const buffer = await downloadTelegramFileBuffer(fileId);
          uploadedPhotoUrl = await uploadBufferToCloudinary(buffer);
        }
      }
    } catch (err) {
      console.error("Photo processing failed:", err);
    }

    if (activeSession) {
      const inputText = incomingText;
      if (uploadedPhotoUrl && (!inputText || inputText.length === 0)) {
        if (activeSession.inputField && activeSession.inputField.startsWith("field:")) {
          const fk = activeSession.inputField.split(":")[1];
          const updateObj: any = {};
          updateObj[`additionalFieldValues.${fk}`] = uploadedPhotoUrl;
          updateObj.waitingForInput = false;
          updateObj.inputField = null;
          await updateWizardSession(activeSession.botMessageId, updateObj);
        } else {
          const newPhotos = [...(activeSession.photos || []), uploadedPhotoUrl];
          await updateWizardSession(activeSession.botMessageId, { photos: newPhotos, waitingForInput: false, inputField: null });
        }
      } else {
        const field = activeSession.inputField;
        if (field === "category") {
          const catName = inputText.toLowerCase();
          await Category.findOneAndUpdate(
            { name: catName },
            { name: catName, displayName: inputText, isActive: true },
            { upsert: true }
          );
          await updateWizardSession(activeSession.botMessageId, { category: catName, waitingForInput: false, inputField: null });
          const updated = await getWizardSession(activeSession.botMessageId);
          await showStepUI(updated, chat.id, activeSession.botMessageId);
        } else if (field === "subcategory") {
          const subUp = await SubCategory.findOneAndUpdate(
            { name: inputText, categoryId: activeSession.category },
            { name: inputText, categoryId: activeSession.category, isActive: true },
            { upsert: true, new: true }
          );
          await updateWizardSession(activeSession.botMessageId, { subCategoryId: String(subUp._id), waitingForInput: false, inputField: null });
          const updated = await getWizardSession(activeSession.botMessageId);
          await showStepUI(updated, chat.id, activeSession.botMessageId);
        } else if (field === "location") {
          await Location.findOneAndUpdate({ name: inputText }, { name: inputText, type: "other", isActive: true }, { upsert: true });
          await updateWizardSession(activeSession.botMessageId, { customLocation: inputText, waitingForInput: false, inputField: null, locationComplete: true });
          const updated = await getWizardSession(activeSession.botMessageId);
          await showStepUI(updated, chat.id, activeSession.botMessageId);
        } else if (field === "agency_date") {
          const parsed = new Date(inputText);
          if (isNaN(parsed.getTime())) {
            await telegramSendMessage(chat.id, "Invalid date format. Please use YYYY-MM-DD.");
            return NextResponse.json({ ok: true });
          }
          await updateWizardSession(activeSession.botMessageId, { agencyDate: parsed, waitingForInput: false, inputField: null });
          const updated = await getWizardSession(activeSession.botMessageId);
          await showStepUI(updated, chat.id, activeSession.botMessageId);
        } else if (field && field.startsWith("field:")) {
          const fk = field.split(":")[1];
          const updateObj: any = {};
          updateObj[`additionalFieldValues.${fk}`] = inputText;
          updateObj.waitingForInput = false;
          updateObj.inputField = null;
          await updateWizardSession(activeSession.botMessageId, updateObj);
          const updated = await getWizardSession(activeSession.botMessageId);
          await showStepUI(updated, chat.id, activeSession.botMessageId);
        } else {
          await updateWizardSession(activeSession.botMessageId, { waitingForInput: false, inputField: null });
        }
      }
      return NextResponse.json({ ok: true });
    }

    // --- New Wizard Creation ---
    const hasPhoto = !!msg.photo || !!msg.document;
    const text = extractTextFromMessage(msg).trim();
    const shouldCreate = hasPhoto || text.length > 5;
    if (!shouldCreate) return NextResponse.json({ ok: true });

    try {
      let detectedCategoryId: string | null = null;
      try {
        const categories = await Category.find({ isActive: true }).lean();
        const lower = (text || "").toLowerCase();
        for (const cat of categories) {
          if (cat.keywords && cat.keywords.length) {
            for (const kw of cat.keywords) {
              if (lower.includes(kw.toLowerCase())) {
                detectedCategoryId = String(cat._id);
                break;
              }
            }
          }
          if (detectedCategoryId) break;
        }
      } catch (err) {
        console.error("Auto-detect failed", err);
      }

      const initialPhotos = uploadedPhotoUrl ? [uploadedPhotoUrl] : [];
      const description = text || (hasPhoto ? "Photo attachment" : "No description provided");

      // Send initial temp message
      const botRes = await telegramSendMessage(chat.id, "⏳ Initializing Wizard...", msg.message_id);
      const botMessageId = (botRes as any)?.result?.message_id;
      if (!botMessageId) return NextResponse.json({ ok: true });

      // Create session
      await createWizardSession(chat.id, msg.from.id, botMessageId, description, detectedCategoryId, initialPhotos);
      
      // Get the fresh session to generate the enhanced UI
      const freshSession = await getWizardSession(botMessageId);
      const baseMessage = await formatEnhancedWizardMessage(freshSession as any);
      
      const divider = `\n\n━━━━━━━━━━━━━━━━\n`;
      const header = detectedCategoryId 
        ? `✅ <b>CATEGORY DETECTED</b>\nConfirm or Change:` 
        : `⬇️ <b>CATEGORY</b> (Select One)`;

      const updatedKeyboard = [
        [{ text: detectedCategoryId ? "📂 Change Category" : "📂 Select Category", callback_data: `step_${botMessageId}_category` }],
        [{ text: "⚡ Select Priority", callback_data: `step_${botMessageId}_priority` }],
        [{ text: "📍 Select Location", callback_data: `step_${botMessageId}_location` }],
      ];

      await editMessageText(chat.id, botMessageId, baseMessage + divider + header, updatedKeyboard);

    } catch (err) {
      console.error("Failed to create wizard session:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("webhook error", err);
    return NextResponse.json({
      ok: false,
      error: (err as any)?.message || String(err),
    });
  }
}