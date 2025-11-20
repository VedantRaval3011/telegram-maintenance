// app/api/webhook/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Ticket } from "@/models/Ticket";
import { Category } from "@/models/Category";
import { Location } from "@/models/Location";
import { WizardSession } from "@/models/WizardSession";
import {
  telegramSendMessage,
  generateTicketId,
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
  buildPriorityKeyboard,
  buildLocationBuildingKeyboard,
  buildLocationFloorKeyboard,
  buildLocationRoomKeyboard,
  createTicketFromWizard,
  updateWizardUI,
} from "@/lib/wizardHelpers";

/**
 * Telegram update shape
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
 * Webhook POST handler (Telegram -> Next.js)
 * - Handles callback queries (button clicks)
 * - Creates wizard sessions for new messages
 * - Marks tickets as COMPLETED when someone replies "Done"
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TelegramUpdate;

    await connectToDB();

    // ==================== HANDLE CALLBACK QUERIES (BUTTON CLICKS) ====================
    if (body.callback_query) {
      const callback = body.callback_query;
      const data = callback.data;
      const messageId = callback.message?.message_id;
      const chatId = callback.message?.chat?.id;

      if (!data || !messageId || !chatId) {
        return NextResponse.json({ ok: true });
      }

      // Parse callback data: "action_messageId_value"
      const parts = data.split("_");
      const action = parts[0];

      // Get wizard session
      const session = await getWizardSession(messageId);
      if (!session) {
        await answerCallbackQuery(callback.id, "Session expired. Please create a new ticket.");
        return NextResponse.json({ ok: true });
      }

      // Handle different actions
      if (action === "cat") {
        const category = parts[2];
        
        if (category === "manual") {
          // Manual category entry
          await updateWizardSession(messageId, {
            waitingForInput: true,
            inputField: "category",
          });
          await updateWizardUI(session);
          await answerCallbackQuery(callback.id, "Please type the category name");
        } else {
          // Standard category selection
          await updateWizardSession(messageId, { category });
          await updateWizardUI(session);
          await answerCallbackQuery(callback.id, `Category: ${category}`);
        }
      } else if (action === "pri") {
        // Priority selection: pri_<msgId>_high
        const priority = parts[2] as "low" | "medium" | "high";
        await updateWizardSession(messageId, { priority });
        await updateWizardUI(session);
        await answerCallbackQuery(callback.id, `Priority: ${priority}`);
      } else if (action === "loc") {
        // Location selection
        const locType = parts[1]; // bld, flr, room, manual
        const value = parts[3];

        if (locType === "manual") {
          // Manual location entry
          await updateWizardSession(messageId, {
            waitingForInput: true,
            inputField: "location",
          });
          await updateWizardUI(session);
          await answerCallbackQuery(callback.id, "Please type the location details");
        } else if (locType === "bld") {
          // Building selected
          const currentSession = await getWizardSession(messageId);
          await updateWizardSession(messageId, {
            location: {
              building: `Building ${value}`,
              floor: currentSession?.location.floor || null,
              room: currentSession?.location.room || null,
            },
            currentStep: "location_floor",
          });
          const keyboard = buildLocationFloorKeyboard(messageId);
          const message = formatWizardMessage(await getWizardSession(messageId) as any);
          await editMessageText(chatId, messageId, message + "\n\n📍 Select Floor:", keyboard);
          await answerCallbackQuery(callback.id);
        } else if (locType === "flr") {
          // Floor selected
          const currentSession = await getWizardSession(messageId);
          await updateWizardSession(messageId, {
            location: {
              building: currentSession?.location.building || null,
              floor: value,
              room: currentSession?.location.room || null,
            },
            currentStep: "location_room",
          });
          const keyboard = buildLocationRoomKeyboard(messageId, value);
          const message = formatWizardMessage(await getWizardSession(messageId) as any);
          await editMessageText(chatId, messageId, message + "\n\n📍 Select Room:", keyboard);
          await answerCallbackQuery(callback.id);
        } else if (locType === "room") {
          // Room selected
          const currentSession = await getWizardSession(messageId);
          await updateWizardSession(messageId, {
            location: {
              building: currentSession?.location.building || null,
              floor: currentSession?.location.floor || null,
              room: value,
            },
            currentStep: "complete",
          });
          await updateWizardUI(await getWizardSession(messageId) as any);
          await answerCallbackQuery(callback.id, `Location complete!`);
        }
      } else if (action === "back") {
        // Back button
        const backTo = parts[2];
        if (backTo === "building") {
          const currentSession = await getWizardSession(messageId);
          await updateWizardSession(messageId, {
            location: {
              building: currentSession?.location.building || null,
              floor: null,
              room: null,
            },
            currentStep: "location_building",
          });
          const keyboard = buildLocationBuildingKeyboard(messageId);
          const message = formatWizardMessage(await getWizardSession(messageId) as any);
          await editMessageText(chatId, messageId, message + "\n\n📍 Select Building:", keyboard);
        } else if (backTo === "floor") {
          const currentSession = await getWizardSession(messageId);
          await updateWizardSession(messageId, {
            location: {
              building: currentSession?.location.building || null,
              floor: currentSession?.location.floor || null,
              room: null,
            },
            currentStep: "location_floor",
          });
          const updatedSession = await getWizardSession(messageId);
          if (updatedSession && updatedSession.location.floor) {
            const keyboard = buildLocationFloorKeyboard(messageId);
            const message = formatWizardMessage(updatedSession);
            await editMessageText(chatId, messageId, message + "\n\n📍 Select Floor:", keyboard);
          }
        }
        await answerCallbackQuery(callback.id);
      } else if (action === "step") {
        // Step selection: step_<msgId>_category
        const step = parts[2];
        if (step === "category") {
          const keyboard = buildCategoryKeyboard(messageId);
          const message = formatWizardMessage(session);
          await editMessageText(chatId, messageId, message + "\n\n📂 Select Category:", keyboard);
        } else if (step === "priority") {
          const keyboard = buildPriorityKeyboard(messageId);
          const message = formatWizardMessage(session);
          await editMessageText(chatId, messageId, message + "\n\n⚡ Select Priority:", keyboard);
        } else if (step === "location") {
          const keyboard = buildLocationBuildingKeyboard(messageId);
          const message = formatWizardMessage(session);
          await editMessageText(chatId, messageId, message + "\n\n📍 Select Building:", keyboard);
        }
        await answerCallbackQuery(callback.id);
      } else if (action === "submit") {
        // Submit wizard and create ticket
        const updatedSession = await getWizardSession(messageId);
        if (updatedSession && isWizardComplete(updatedSession)) {
          const createdBy =
            callback.from?.username ||
            `${callback.from?.first_name || ""} ${callback.from?.last_name || ""}`.trim();

          console.log("[TICKET] Creating ticket from wizard session");
          console.log("[TICKET] Session photos:", updatedSession.photos);
          
          const ticket = await createTicketFromWizard(updatedSession, createdBy);
          
          console.log("[TICKET] Created ticket:", ticket.ticketId);
          console.log("[TICKET] Ticket photos:", ticket.photos);

          // Format final ticket message
          const categoryEmoji: Record<string, string> = {
            electrical: "⚡",
            plumbing: "🚰",
            furniture: "🪑",
            cleaning: "🧹",
            hvac: "❄️",
            paint: "🎨",
            other: "📋",
          };

          const priorityEmoji: Record<string, string> = {
            high: "🔴",
            medium: "🟡",
            low: "🟢",
          };

          const finalMessage = `🎫 <b>Ticket ${ticket.ticketId} Created</b>\n📝 Issue: ${ticket.description}\n\n<b>Category:</b> ${categoryEmoji[ticket.category || "other"] || "📋"} ${ticket.category}\n<b>Priority:</b> ${priorityEmoji[ticket.priority] || "⚪"} ${ticket.priority}\n<b>Location:</b> ${ticket.location}\n<b>Created by:</b> ${createdBy}`;

          await editMessageText(chatId, messageId, finalMessage, []);
          await deleteWizardSession(messageId);
          await answerCallbackQuery(callback.id, "Ticket created successfully!");
        } else {
          await answerCallbackQuery(callback.id, "Please complete all fields first.", true);
        }
      }

      return NextResponse.json({ ok: true });
    }

    // ==================== HANDLE REGULAR MESSAGES ====================
    const msg = body.message || body.edited_message;
    if (!msg) return NextResponse.json({ ok: true });

    // Ignore messages from bots
    if (msg.from?.is_bot) return NextResponse.json({ ok: true });

    const chat = msg.chat;
    const chatType = chat?.type;

    // Only process group/supergroup messages
    if (chatType !== "group" && chatType !== "supergroup") {
      return NextResponse.json({ ok: true });
    }

    // Track user from webhook message
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

    // Normalize incoming text
    const incomingText = (msg.text || msg.caption || "")
      .toString()
      .trim()
      .toLowerCase();

    // ==================== HANDLE WIZARD INPUT ====================
    // Check if user has an active wizard session waiting for input
    const activeSession = await WizardSession.findOne({
      userId: msg.from.id,
      waitingForInput: true,
    });

    if (activeSession) {
      const inputText = (msg.text || msg.caption || "").trim();
      
      if (inputText.length > 0) {
        if (activeSession.inputField === "category") {
          // Update session
          await updateWizardSession(activeSession.botMessageId, {
            category: inputText.toLowerCase(),
            waitingForInput: false,
            inputField: null,
          });

          // Update Category Master
          try {
            await Category.findOneAndUpdate(
              { name: inputText.toLowerCase() },
              {
                name: inputText.toLowerCase(),
                displayName: inputText, // Use original casing for display if possible, but here we have input text
                isActive: true,
              },
              { upsert: true, new: true }
            );
          } catch (err) {
            console.error("Failed to update Category master:", err);
          }

        } else if (activeSession.inputField === "location") {
          // Update session
          await updateWizardSession(activeSession.botMessageId, {
            customLocation: inputText,
            waitingForInput: false,
            inputField: null,
            currentStep: "complete",
          });

          // Update Location Master
          try {
            await Location.findOneAndUpdate(
              { name: inputText },
              {
                name: inputText,
                type: "other",
                isActive: true,
              },
              { upsert: true, new: true }
            );
          } catch (err) {
            console.error("Failed to update Location master:", err);
          }
        }

        // Update UI
        const updatedSession = await getWizardSession(activeSession.botMessageId);
        if (updatedSession) {
          await updateWizardUI(updatedSession);
        }
        
        // Delete user's input message to keep chat clean (optional, skipping for now to avoid permission issues)
      }
      
      return NextResponse.json({ ok: true });
    }

    // COMPLETION FLOW: Mark ticket as COMPLETED
    if (incomingText === "done" || incomingText === "completed") {
      const replyTo = msg.reply_to_message;
      if (replyTo && replyTo.message_id) {
        const telegramMessageId = replyTo.message_id;
        const telegramChatId = replyTo.chat?.id || chat?.id;

        const ticket = await Ticket.findOne({
          telegramMessageId,
          telegramChatId,
          status: "PENDING",
        });

        if (ticket) {
          ticket.status = "COMPLETED";
          ticket.completedBy =
            msg.from?.username ||
            `${msg.from?.first_name || ""} ${msg.from?.last_name || ""}`.trim();
          ticket.completedAt = new Date();
          await ticket.save();

          const completeText = `✔ Ticket ${ticket.ticketId} Completed by ${
            ticket.completedBy || "Unknown"
          }`;
          try {
            await telegramSendMessage(telegramChatId, completeText);
          } catch (err) {
            console.error("Failed to notify group about completion:", err);
          }
        }
      }
      return NextResponse.json({ ok: true });
    }

    // NEW TICKET FLOW: Create wizard session
    const hasPhoto = !!msg.photo || !!msg.document;
    const text = extractTextFromMessage(msg).trim();
    const shouldCreate = hasPhoto || text.length > 5;

    if (!shouldCreate) return NextResponse.json({ ok: true });

    // Handle Photo Upload
    let uploadedPhotoUrl: string | null = null;
    if (hasPhoto) {
      console.log("[PHOTO] Message has photo, attempting to process...");
      try {
        const { downloadTelegramFile } = await import("@/lib/telegram");
        const { uploadToCloudinary } = await import("@/lib/cloudinary");
        const path = await import("path");
        const fs = await import("fs");
        
        // Get the largest photo
        const fileId = msg.photo 
          ? msg.photo[msg.photo.length - 1].file_id 
          : msg.document?.file_id;

        console.log("[PHOTO] File ID:", fileId);

        if (fileId) {
          console.log("[PHOTO] Downloading file:", fileId);
          
          // Use absolute path for tmp directory
          const tmpDir = path.join(process.cwd(), "tmp");
          
          // Ensure tmp directory exists
          if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
            console.log("[PHOTO] Created tmp directory:", tmpDir);
          }
          
          const localPath = await downloadTelegramFile(fileId, tmpDir);
          console.log("[PHOTO] Downloaded to:", localPath);
          
          console.log("[PHOTO] Uploading to Cloudinary...");
          console.log("[PHOTO] Cloudinary config check:", {
            hasCloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
            hasApiKey: !!process.env.CLOUDINARY_API_KEY,
            hasApiSecret: !!process.env.CLOUDINARY_API_SECRET,
          });
          
          uploadedPhotoUrl = await uploadToCloudinary(localPath);
          console.log("[PHOTO] Uploaded to Cloudinary:", uploadedPhotoUrl);
          
          // Clean up local file
          if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
            console.log("[PHOTO] Cleaned up local file");
          }
        } else {
          console.log("[PHOTO] No file ID found");
        }
      } catch (err) {
        console.error("[PHOTO] Failed to process photo:", err);
        console.error("[PHOTO] Error details:", {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }
    } else {
      console.log("[PHOTO] Message does not have photo");
    }

    // Check if user has an active wizard session (for adding photos to existing session)
    // We check this BEFORE creating a new session
    const existingSession = await WizardSession.findOne({
      userId: msg.from.id,
      // We want to attach photo to ANY active session, not just waitingForInput
      // But usually we only want to do this if the user is interacting with the wizard
      // For simplicity, if there is a session that is NOT complete, we attach to it
    }).sort({ createdAt: -1 });

    if (existingSession && !isWizardComplete(existingSession) && uploadedPhotoUrl) {
      console.log("[PHOTO] Adding to existing session:", existingSession.botMessageId);
      console.log("[PHOTO] Current photos:", existingSession.photos);
      
      // Add photo to existing session
      await updateWizardSession(existingSession.botMessageId, {
        photos: [...(existingSession.photos || []), uploadedPhotoUrl]
      });
      
      const updatedSession = await getWizardSession(existingSession.botMessageId);
      console.log("[PHOTO] Updated session photos:", updatedSession?.photos);
      
      await updateWizardUI(updatedSession as any);
      
      // Delete user's message to keep chat clean? Maybe not for photos.
      return NextResponse.json({ ok: true });
    }

    const description = text || (hasPhoto ? "Photo attachment" : "No description provided");

    // Create wizard session
    try {
      // Auto-detect category
      let detectedCategory: string | null = null;
      let categoryEmojiChar = "📋";
      
      try {
        const categories = await Category.find({ isActive: true });
        const lowerDesc = description.toLowerCase();
        
        for (const cat of categories) {
          if (cat.keywords && cat.keywords.length > 0) {
            for (const keyword of cat.keywords) {
              if (lowerDesc.includes(keyword.toLowerCase())) {
                detectedCategory = cat.name;
                // Try to find emoji for this category
                const categoryEmoji: Record<string, string> = {
                  electrical: "⚡",
                  plumbing: "🚰",
                  furniture: "🪑",
                  cleaning: "🧹",
                  hvac: "❄️",
                  paint: "🎨",
                  other: "📋",
                };
                categoryEmojiChar = categoryEmoji[cat.name] || "📋";
                break;
              }
            }
          }
          if (detectedCategory) break;
        }
      } catch (err) {
        console.error("Failed to auto-detect category:", err);
      }

      const categoryDisplay = detectedCategory 
        ? `${categoryEmojiChar} ${detectedCategory.charAt(0).toUpperCase() + detectedCategory.slice(1)}` 
        : "—";

      const initialPhotos = uploadedPhotoUrl ? [uploadedPhotoUrl] : [];
      const photosText = initialPhotos.length > 0 
        ? `📸 <b>Photos:</b> ${initialPhotos.length} attached`
        : "📸 <b>Photos:</b> None (Send an image to attach)";

      const wizardMessage = `🛠 <b>Ticket Wizard</b>\n📝 Issue: ${description}\n\n<b>Category:</b> ${categoryDisplay}\n<b>Priority:</b> —\n<b>Location:</b> —\n${photosText}\n\n${detectedCategory ? "✅ Category auto-detected! Change if needed." : "⚠️ Please complete the selections below:"}`;

      const keyboard = [
        [{ text: detectedCategory ? "📂 Change Category" : "📂 Select Category", callback_data: `step_TEMP_category` }],
        [{ text: "⚡ Select Priority", callback_data: `step_TEMP_priority` }],
        [{ text: "📍 Select Location", callback_data: `step_TEMP_location` }],
      ];

      const botRes = await telegramSendMessage(
        chat.id,
        wizardMessage,
        msg.message_id,
        keyboard
      );

      const botMessageId =
        botRes && (botRes as any).result && (botRes as any).result.message_id
          ? (botRes as any).result.message_id
          : undefined;

      if (botMessageId) {
        // Create wizard session
        await createWizardSession(chat.id, msg.from.id, botMessageId, description, detectedCategory, initialPhotos);

        // Update keyboard with actual message ID
        const updatedKeyboard = [
          [{ text: detectedCategory ? "📂 Change Category" : "📂 Select Category", callback_data: `step_${botMessageId}_category` }],
          [{ text: "⚡ Select Priority", callback_data: `step_${botMessageId}_priority` }],
          [{ text: "📍 Select Location", callback_data: `step_${botMessageId}_location` }],
        ];

        await editMessageText(chat.id, botMessageId, wizardMessage, updatedKeyboard);
      }
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
