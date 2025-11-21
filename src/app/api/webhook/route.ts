// app/api/webhook/route.ts
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
  formatWizardMessage,
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
 * Helper: show a step UI based on the resolved step key
 * - session: the up-to-date session mongoose doc (not lean)
 * - chatId, messageId: where to edit the wizard message
 */
async function showStepUI(session: any, chatId: number, messageId: number) {
  const next = await resolveNextStep(session);
  session.currentStep = next;
  await session.save?.() ?? await updateWizardSession(session.botMessageId, { currentStep: next });

  // Load appropriate keyboard or set waitingForInput prompt
  if (next === "category") {
    const keyboard = await buildCategoryKeyboard(session.botMessageId);
    const message = formatWizardMessage(session);
    await editMessageText(chatId, messageId, message + "\n\n📂 Select Category:", keyboard);
    return;
  }

  if (next === "priority") {
    const keyboard = buildPriorityKeyboard(session.botMessageId);
    const message = formatWizardMessage(session);
    await editMessageText(chatId, messageId, message + "\n\n⚡ Select Priority:", keyboard);
    return;
  }

  if (next === "subcategory") {
    // session.category contains categoryId (string)
    const keyboard = await buildSubCategoryKeyboard(session.botMessageId, session.category);
    const message = formatWizardMessage(session);
    await editMessageText(chatId, messageId, message + "\n\n🧩 Select Subcategory:", keyboard);
    return;
  }

  if (next === "location") {
    const keyboard = await buildLocationChildrenKeyboard(session.botMessageId, null);
    const message = formatWizardMessage(session);
    await editMessageText(chatId, messageId, message + "\n\n📍 Select Location:", keyboard);
    return;
  }

  if (next === "source_location") {
    const keyboard = await buildLocationChildrenKeyboard(session.botMessageId, null);
    const message = formatWizardMessage(session);
    await editMessageText(chatId, messageId, message + "\n\n📍 Select Source Location (From):", keyboard);
    return;
  }

  if (next === "target_location") {
    const keyboard = await buildLocationChildrenKeyboard(session.botMessageId, null);
    const message = formatWizardMessage(session);
    await editMessageText(chatId, messageId, message + "\n\n📍 Select Target Location (To):", keyboard);
    return;
  }

  if (next === "agency") {
    const keyboard = buildAgencyKeyboard(session.botMessageId);
    const message = formatWizardMessage(session);
    await editMessageText(chatId, messageId, message + "\n\n🧾 Is this work done by an agency?", keyboard);
    return;
  }

  if (next === "agency_date") {
    // ask user to type date in YYYY-MM-DD
    const message = formatWizardMessage(session);
    await editMessageText(chatId, messageId, message + "\n\n📅 Please type the agency date (YYYY-MM-DD):", []);
    await updateWizardSession(session.botMessageId, { waitingForInput: true, inputField: "agency_date" });
    return;
  }

  if (next === "additional_fields") {
    const rule = await WorkflowRule.findOne({ categoryId: session.category }).lean();
    const fields = rule?.additionalFields || [];
    const keyboard = buildAdditionalFieldsKeyboard(session.botMessageId, fields);
    const message = formatWizardMessage(session);
    await editMessageText(chatId, messageId, message + "\n\n📝 Provide additional details:", keyboard);
    return;
  }

  if (next === "complete") {
    // Show final keyboard (create ticket) but do not auto-submit
    const keyboard = await buildWizardKeyboard(session);
    const message = formatWizardMessage(session);
    await editMessageText(chatId, messageId, message, keyboard);
    return;
  }

  // Fallback: render the main wizard keyboard
  const keyboard = await buildWizardKeyboard(session);
  const message = formatWizardMessage(session);
  await editMessageText(chatId, messageId, message, keyboard);
}

/**
 * Handle loc child click:
 * - append node to relevant path (location / source / target depending on session.currentStep)
 * - check if this location node has children; if yes show children of picked node
 * - if no children: mark pathComplete for that kind and move to next step
 */
async function handleLocationChildClick(session: any, chatId: number, messageId: number, pickedLocationId: string, callbackQueryId: string) {
  // fetch picked location for name and whether it has children
  const picked = await Location.findById(pickedLocationId).lean();
  if (!picked) {
    await answerCallbackQuery(callbackQueryId, "Location not found.");
    return;
  }

  // Determine which path to update
  const step = session.currentStep || (await resolveNextStep(session));
  let pathField = "locationPath";
  let completeField = "locationComplete";
  if (step === "source_location") {
    pathField = "sourceLocationPath";
    completeField = "sourceLocationComplete";
  } else if (step === "target_location") {
    pathField = "targetLocationPath";
    completeField = "targetLocationComplete";
  } else {
    pathField = "locationPath";
    completeField = "locationComplete";
  }

  // Append node
  const node = { id: String(picked._id), name: picked.name };
  const currentPath = (session as any)[pathField] || [];
  const newPath = appendLocationNodeToPath(currentPath, node);

  // Check if node has children
  const childrenCount = await Location.countDocuments({ parentLocationId: picked._id });

  if (childrenCount && childrenCount > 0) {
    // update session: set path and selectedLocationId to picked._id, but not complete
    await updateWizardSession(session.botMessageId, {
      [pathField]: newPath,
      selectedLocationId: String(picked._id),
    });
    const updatedSession = await getWizardSession(session.botMessageId);
    // show children of this node
    const keyboard = await buildLocationChildrenKeyboard(session.botMessageId, String(picked._id));
    const message = formatWizardMessage(updatedSession as any);
    await editMessageText(chatId, messageId, message + `\n\n📍 Selected: ${picked.name}\n\nSelect child:`, keyboard);
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

      // tokens: action_botmsgid_rest...
      // but sometimes botmsgid includes underscores (rare). We parse with index of bot message id after action.
      const parts = data.split("_");
      const action = parts[0];

      // get session by bot message id (bot created message id)
      const session = await getWizardSession(messageId);
      if (!session) {
        await answerCallbackQuery(callback.id, "Session expired. Please create a new ticket.");
        return NextResponse.json({ ok: true });
      }

      // === CATEGORY selection: cat_<botId>_<categoryId|manual> ===
      if (action === "cat") {
        const categoryId = parts.slice(2).join("_"); // join for safety
        if (categoryId === "manual") {
          // Manual entry disabled
          await answerCallbackQuery(callback.id, "Manual entry is disabled. Please select from the list.");
          return NextResponse.json({ ok: true });
        } else {
          // set categoryId (store as string id)
          await updateWizardSession(session.botMessageId, {
            category: categoryId,
            subCategoryId: null, // reset
          });
          const updated = await getWizardSession(session.botMessageId);
          // jump to next step UI
          await showStepUI(updated, chatId, messageId);
          await answerCallbackQuery(callback.id, "Category selected.");
          return NextResponse.json({ ok: true });
        }
      }

      // === SUBCATEGORY selection: sub_<botId>_<subId|manual> ===
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

      // === PRIORITY: pri_<botId>_<low|medium|high> ===
      if (action === "pri") {
        const priority = parts[2] as "low" | "medium" | "high";
        await updateWizardSession(session.botMessageId, { priority });
        const updated = await getWizardSession(session.botMessageId);
        await showStepUI(updated, chatId, messageId);
        await answerCallbackQuery(callback.id, `Priority set to ${priority}`);
        return NextResponse.json({ ok: true });
      }

      // === LOCATION tree actions ===
      // loc_<botId>_child_<locationId>
      // loc_<botId>_back_<parentId or root>
      // loc_<botId>_manual
      if (action === "loc") {
        const subact = parts[2];
        if (subact === "child") {
          const pickedLocationId = parts.slice(3).join("_");
          await handleLocationChildClick(session, chatId, messageId, pickedLocationId, callback.id);
          return NextResponse.json({ ok: true });
        } else if (subact === "back") {
          const backId = parts.slice(3).join("_");
          // if back to root
          const parentId = backId === "root" ? null : backId;
          // show children of parentId
          const keyboard = await buildLocationChildrenKeyboard(session.botMessageId, parentId);
          const updatedSession = await getWizardSession(session.botMessageId);
          const message = formatWizardMessage(updatedSession as any);
          await editMessageText(chatId, messageId, message + "\n\n📍 Select Location:", keyboard);
          await answerCallbackQuery(callback.id);
          return NextResponse.json({ ok: true });
        } else if (subact === "manual") {
          // manual location text entry disabled
          await answerCallbackQuery(callback.id, "Manual entry is disabled.");
          return NextResponse.json({ ok: true });
        }
      }

      // === AGENCY: agency_<botId>_yes|no ===
      if (action === "agency") {
        const val = parts[2];
        if (val === "yes") {
          // set agencyRequired true
          await updateWizardSession(session.botMessageId, { agencyRequired: true });
          // get workflow rule to see if date required
          const rule = await WorkflowRule.findOne({ categoryId: session.category }).lean();
          if (rule && rule.requiresAgencyDate) {
            // ask for date input
            await updateWizardSession(session.botMessageId, { waitingForInput: true, inputField: "agency_date" });
            const updated = await getWizardSession(session.botMessageId);
            const message = formatWizardMessage(updated as any);
            await editMessageText(chatId, messageId, message + "\n\n📅 Please type the agency date (YYYY-MM-DD):", []);
            await answerCallbackQuery(callback.id, "Please provide agency date.");
            return NextResponse.json({ ok: true });
          } else {
            const updated = await getWizardSession(session.botMessageId);
            await showStepUI(updated, chatId, messageId);
            await answerCallbackQuery(callback.id, "Agency: Yes");
            return NextResponse.json({ ok: true });
          }
        } else {
          // no
          await updateWizardSession(session.botMessageId, { agencyRequired: false, agencyDate: null });
          const updated = await getWizardSession(session.botMessageId);
          await showStepUI(updated, chatId, messageId);
          await answerCallbackQuery(callback.id, "Agency: No");
          return NextResponse.json({ ok: true });
        }
      }

      // === ADDITIONAL FIELD BUTTON: field_<botId>_<fieldKey> ===
      if (action === "field") {
        const fieldKey = parts.slice(2).join("_");
        // mark waitingForInput for that field: store as "field:<key>"
        await updateWizardSession(session.botMessageId, { waitingForInput: true, inputField: `field:${fieldKey}` });
        const updated = await getWizardSession(session.botMessageId);
        const message = formatWizardMessage(updated as any);
        await editMessageText(chatId, messageId, message + `\n\n✍️ Please type value for ${fieldKey}:`, []);
        await answerCallbackQuery(callback.id, `Provide ${fieldKey}`);
        return NextResponse.json({ ok: true });
      }

      // === STEP navigation: step_<botId>_<stepName> ===
      if (action === "step") {
        const stepName = parts.slice(2).join("_");
        if (stepName === "category") {
          const keyboard = await buildCategoryKeyboard(session.botMessageId);
          const message = formatWizardMessage(session);
          await editMessageText(chatId, messageId, message + "\n\n📂 Select Category:", keyboard);
        } else if (stepName === "priority") {
          const keyboard = buildPriorityKeyboard(session.botMessageId);
          const message = formatWizardMessage(session);
          await editMessageText(chatId, messageId, message + "\n\n⚡ Select Priority:", keyboard);
        } else if (stepName === "location") {
          const keyboard = await buildLocationChildrenKeyboard(session.botMessageId, null);
          const message = formatWizardMessage(session);
          await editMessageText(chatId, messageId, message + "\n\n📍 Select Location:", keyboard);
        } else if (stepName === "subcategory") {
          const keyboard = await buildSubCategoryKeyboard(session.botMessageId, session.category);
          const message = formatWizardMessage(session);
          await editMessageText(chatId, messageId, message + "\n\n🧩 Select Subcategory:", keyboard);
        } else if (stepName === "agency") {
          const keyboard = buildAgencyKeyboard(session.botMessageId);
          const message = formatWizardMessage(session);
          await editMessageText(chatId, messageId, message + "\n\n🧾 Agency?", keyboard);
        } else if (stepName === "additional_fields") {
          const rule = await WorkflowRule.findOne({ categoryId: session.category }).lean();
          const keyboard = buildAdditionalFieldsKeyboard(session.botMessageId, rule?.additionalFields || []);
          const message = formatWizardMessage(session);
          await editMessageText(chatId, messageId, message + "\n\n📝 Additional Fields:", keyboard);
        }
        await answerCallbackQuery(callback.id);
        return NextResponse.json({ ok: true });
      }

      // === SUBMIT === submit_<botId>
      if (action === "submit") {
        // Check completeness server-side
        const fresh = await getWizardSession(session.botMessageId);
        const complete = await isWizardComplete(fresh as any);
        if (!complete) {
          await answerCallbackQuery(callback.id, "Please complete all required fields first.", true);
          return NextResponse.json({ ok: true });
        }

        // Create ticket
        const createdBy =
          callback.from?.username ||
          `${callback.from?.first_name || ""} ${callback.from?.last_name || ""}`.trim();

        const ticket = await createTicketFromWizard(fresh as any, createdBy);

        // Q4 chosen: keep wizard message, send a new message with ticket summary
        const categoryText = ticket.categoryDisplay || ticket.category || "—";
        const ticketMsg = `🎫 <b>Ticket ${ticket.ticketId} Created</b>\n📝 ${ticket.description}\n\n<b>Category:</b> ${categoryText}\n<b>Priority:</b> ${ticket.priority}\n<b>Location:</b> ${ticket.location}\n<b>Created by:</b> ${createdBy}`;
        try {
          await telegramSendMessage(chatId, ticketMsg);
        } catch (err) {
          console.error("Failed to send ticket message:", err);
        }

        // Keep the wizard message as-is but mark session deleted
        await deleteWizardSession(session.botMessageId);
        await answerCallbackQuery(callback.id, "Ticket created successfully!");
        return NextResponse.json({ ok: true });
      }

      // Unknown callback falls through
      await answerCallbackQuery(callback.id, "Action not recognized.");
      return NextResponse.json({ ok: true });
    }

    // ---------- NORMAL MESSAGES (non-callback) ----------
    const msg = body.message || body.edited_message;
    if (!msg) return NextResponse.json({ ok: true });

    // ignore bots
    if (msg.from?.is_bot) return NextResponse.json({ ok: true });

    const chat = msg.chat;
    const chatType = chat?.type;
    if (chatType !== "group" && chatType !== "supergroup") return NextResponse.json({ ok: true });

    // optional: track user (your existing logic)
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

    // --- CANCEL handling (Q5 A) ---
    if (incomingText && (incomingText.toLowerCase() === "/cancel" || incomingText.toLowerCase() === "cancel")) {
      // find latest active session for this user
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

    // --- Handle waitingForInput for any active session(s) ---
    // Because Q2 = B (multiple wizards allowed), we must pick the most recent session for which waitingForInput=true
    const activeSession = await WizardSession.findOne({ userId: msg.from.id, waitingForInput: true }).sort({ createdAt: -1 });

    // Photo handling: upload if exists
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

    // If there's an active session waiting for input, consume this message as its input
    if (activeSession) {
      const inputText = incomingText;
      if (uploadedPhotoUrl && (!inputText || inputText.length === 0)) {
        // treat photo as input for photo-type field if inputField indicates that; otherwise attach to photos
        if (activeSession.inputField && activeSession.inputField.startsWith("field:")) {
          const fk = activeSession.inputField.split(":")[1];
          const updateObj: any = {};
          updateObj[`additionalFieldValues.${fk}`] = uploadedPhotoUrl;
          updateObj.waitingForInput = false;
          updateObj.inputField = null;
          await updateWizardSession(activeSession.botMessageId, updateObj);
        } else {
          // attach photo to session
          const newPhotos = [...(activeSession.photos || []), uploadedPhotoUrl];
          await updateWizardSession(activeSession.botMessageId, { photos: newPhotos, waitingForInput: false, inputField: null });
        }
      } else {
        // text-based inputs
        const field = activeSession.inputField;
        if (field === "category") {
          const catName = inputText.toLowerCase();
          // create or upsert category
          await Category.findOneAndUpdate(
            { name: catName },
            { name: catName, displayName: inputText, isActive: true },
            { upsert: true }
          );
          await updateWizardSession(activeSession.botMessageId, { category: catName, waitingForInput: false, inputField: null });
          const updated = await getWizardSession(activeSession.botMessageId);
          await showStepUI(updated, chat.id, activeSession.botMessageId);
        } else if (field === "subcategory") {
          // upsert into SubCategory (store id)
          const subUp = await SubCategory.findOneAndUpdate(
            { name: inputText, categoryId: activeSession.category },
            { name: inputText, categoryId: activeSession.category, isActive: true },
            { upsert: true, new: true }
          );
          await updateWizardSession(activeSession.botMessageId, { subCategoryId: String(subUp._id), waitingForInput: false, inputField: null });
          const updated = await getWizardSession(activeSession.botMessageId);
          await showStepUI(updated, chat.id, activeSession.botMessageId);
        } else if (field === "location") {
          // manual location -> store as customLocation and upsert Location master
          await Location.findOneAndUpdate({ name: inputText }, { name: inputText, type: "other", isActive: true }, { upsert: true });
          await updateWizardSession(activeSession.botMessageId, { customLocation: inputText, waitingForInput: false, inputField: null, locationComplete: true });
          const updated = await getWizardSession(activeSession.botMessageId);
          await showStepUI(updated, chat.id, activeSession.botMessageId);
        } else if (field === "agency_date") {
          // parse date (simple YYYY-MM-DD)
          const parsed = new Date(inputText);
          if (isNaN(parsed.getTime())) {
            // invalid date
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
          // Unrecognized waitingForInput -> ignore
          await updateWizardSession(activeSession.botMessageId, { waitingForInput: false, inputField: null });
        }
      }
      return NextResponse.json({ ok: true });
    }

    // --- No active waiting-for-input session: potential new wizard creation or attach photo to existing incomplete session ---
    // Because Q2 = B (multiple parallel wizards allowed), we WILL create a new wizard for each qualifying message.
    const hasPhoto = !!msg.photo || !!msg.document;
    const text = extractTextFromMessage(msg).trim();
    const shouldCreate = hasPhoto || text.length > 5;
    if (!shouldCreate) return NextResponse.json({ ok: true });

    // Create new wizard session for this message
    try {
      // auto-detect category by keywords (best-effort)
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

      const wizardMessage = `🛠 <b>Ticket Wizard</b>\n📝 Issue: ${description}\n\n<b>Category:</b> ${detectedCategoryId ? "(auto-detected)" : "—"}\n<b>Priority:</b> —\n<b>Location:</b> —\n\n${initialPhotos.length > 0 ? `📸 <b>Photos:</b> ${initialPhotos.length} attached` : "📸 <b>Photos:</b> None (Send an image to attach)"}\n\n${detectedCategoryId ? "✅ Category auto-detected! Change if needed." : "⚠️ Please complete the selections below:"}`;

      // Send wizard message (reply to user's message to keep context)
      const botRes = await telegramSendMessage(chat.id, wizardMessage, msg.message_id, [
        [{ text: detectedCategoryId ? "📂 Change Category" : "📂 Select Category", callback_data: `step_TEMP_category` }],
        [{ text: "⚡ Select Priority", callback_data: `step_TEMP_priority` }],
        [{ text: "📍 Select Location", callback_data: `step_TEMP_location` }],
      ]);

      const botMessageId = (botRes as any)?.result?.message_id;
      if (!botMessageId) {
        console.error("Failed to create wizard message");
        return NextResponse.json({ ok: true });
      }

      // create session
      await createWizardSession(chat.id, msg.from.id, botMessageId, description, detectedCategoryId, initialPhotos);

      // update keyboard with real botMessageId tokens
      const updatedKeyboard = [
        [{ text: detectedCategoryId ? "📂 Change Category" : "📂 Select Category", callback_data: `step_${botMessageId}_category` }],
        [{ text: "⚡ Select Priority", callback_data: `step_${botMessageId}_priority` }],
        [{ text: "📍 Select Location", callback_data: `step_${botMessageId}_location` }],
      ];
      await editMessageText(chat.id, botMessageId, wizardMessage, updatedKeyboard);
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
