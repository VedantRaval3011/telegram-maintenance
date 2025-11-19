// app/api/webhook/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Ticket } from "@/models/Ticket";
import {
  telegramSendMessage,
  downloadTelegramFile,
  generateTicketId,
} from "@/lib/telegram";

/**
 * Minimal typing for the incoming Telegram update — we only care about `message` and `edited_message`.
 * The `message` shape is "any" because Telegram messages are large and varied; we narrow at runtime.
 */
interface TelegramUpdate {
  update_id?: number;
  message?: any;
  edited_message?: any;
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

/** Very small heuristic to categorize and pick priority/location */
function detectCategoryAndPriorityAndLocation(text: string) {
  const t = (text || "").toLowerCase();
  const categories: Record<string, string[]> = {
    electrical: [
      "light",
      "bulb",
      "electr",
      "switch",
      "plug",
      "socket",
      "fan",
      "power",
    ],
    plumbing: ["leak", "tap", "toilet", "flush", "plumb", "drain", "water"],
    furniture: ["table", "chair", "desk", "sofa", "broken", "furniture"],
    cleaning: ["spill", "trash", "clean", "dirty", "stain"],
    hvac: [
      "ac",
      "aircon",
      "air conditioner",
      "temperature",
      "cooling",
      "heater",
    ],
    other: [],
  };

  let category: string | null = null;
  for (const [k, keywords] of Object.entries(categories)) {
    if (keywords.some((kw) => t.includes(kw))) {
      category = k;
      break;
    }
  }

  // location: look for patterns like "room 406" or "rm 101" or any 2-4 digit number (as fallback)
  let location: string | null = null;
  const locMatch = text.match(/\b(?:room|rm|r\.?)\s*#?\s*(\d{1,4})\b/i);
  if (locMatch) {
    location = `room ${locMatch[1]}`;
  } else {
    const roomNum = text.match(/\b(\d{2,4})\b/);
    if (roomNum) location = `room ${roomNum[1]}`;
  }

  // priority heuristics
  let priority: "low" | "medium" | "high" = "medium";
  if (
    /\burgent\b|\basap\b|\bimmediately\b|\bdanger\b|\bfire\b|\belectric shock\b|\bno light\b|\bno power\b|\bnot working\b/i.test(
      text
    )
  ) {
    priority = "high";
  } else if (/\bsoon\b|\bplease\b|\bwhenever\b/i.test(text)) {
    priority = "low";
  }

  return { category, priority, location };
}

/**
 * Webhook POST handler for Telegram updates
 * - Creates tickets for messages with text or photos
 * - Marks tickets as COMPLETED when someone replies "Done" to the bot message (or the ticket message)
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TelegramUpdate;
    const msg = body.message || body.edited_message;
    if (!msg) {
      // Not a message update (e.g., callback_query, inline_query). Ignore.
      return NextResponse.json({ ok: true });
    }

    // ignore messages from other bots to prevent loops
    if (msg.from?.is_bot) {
      return NextResponse.json({ ok: true });
    }

    const chat = msg.chat;
    const chatType = chat?.type;

    // Only process group/supergroup messages (adjust if you also want private chats)
    if (chatType !== "group" && chatType !== "supergroup") {
      return NextResponse.json({ ok: true });
    }

    // Connect to DB early
    await connectToDB();

    // If message is a reply and its text is "done" or "completed", try to mark ticket completed
    const incomingText = (msg.text || msg.caption || "")
      .toString()
      .trim()
      .toLowerCase();

    if (incomingText === "done" || incomingText === "completed") {
      const replyTo = msg.reply_to_message;
      if (replyTo && replyTo.message_id) {
        // Try to find the ticket matching the message ID that was replied to.
        // Tickets store the `telegramMessageId` (the message id of the original message that created the ticket).
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

          // notify the group
          const text = `✔ Ticket ${ticket.ticketId} Completed by ${
            ticket.completedBy || "Unknown"
          }`;
          try {
            await telegramSendMessage(telegramChatId, text);
          } catch (err) {
            console.error("Failed to notify group about completion:", err);
          }
        } else {
          // Optionally: If no ticket found by message id, you might attempt to parse ticketId from the reply text or replied message.
          console.debug(
            "No matching pending ticket found for reply_to_message_id:",
            telegramMessageId
          );
        }
      }
      return NextResponse.json({ ok: true });
    }

    // Otherwise: treat as a new ticket insertion when message has photo or sufficient text
    const hasPhoto = !!msg.photo || !!msg.document; // doc might be an image as well
    const text = extractTextFromMessage(msg).trim();
    const shouldCreate = hasPhoto || text.length > 5; // threshold

    if (!shouldCreate) {
      // Not an actionable message
      return NextResponse.json({ ok: true });
    }

    // Build ticket fields
    const description = text || "No description provided";
    const { category, priority, location } =
      detectCategoryAndPriorityAndLocation(description);

    // download photos/docs (if present)
    const photosSaved: string[] = [];

    // If msg.photo exists: it's an array of sizes; pick the largest
    if (Array.isArray(msg.photo) && msg.photo.length > 0) {
      const largest = msg.photo[msg.photo.length - 1];
      if (largest?.file_id) {
        try {
          const savedPath = await downloadTelegramFile(largest.file_id);
          photosSaved.push(savedPath);
        } catch (err) {
          console.error("Failed downloading photo (photo array):", err);
        }
      }
    }

    // If msg.document exists and it's an image, or any file you want to save
    if (msg.document && msg.document.file_id) {
      try {
        const savedPath = await downloadTelegramFile(msg.document.file_id);
        photosSaved.push(savedPath);
      } catch (err) {
        console.error("Failed downloading document:", err);
      }
    }

    // Create a ticket id (uses Ticket model count; consider atomic counter in prod)
    const ticketId = await generateTicketId();

    const createdBy =
      msg.from?.username ||
      `${msg.from?.first_name || ""} ${msg.from?.last_name || ""}`.trim();

    // Persist ticket
    const ticket = await Ticket.create({
      ticketId,
      description,
      category,
      priority,
      location,
      photos: photosSaved,
      createdBy,
      createdAt: new Date(),
      status: "PENDING",
      telegramMessageId: msg.message_id, // message id of the incoming message that triggered ticket creation
      telegramChatId: chat?.id,
    });

    // Reply back in group, referencing the original message (so staff can reply to bot message with "Done")
    const replyText = `🆕 Ticket ${ticket.ticketId} Created\nIssue: ${ticket.description}`;
    try {
      // Reply to the original reporter's message. Alternatively, you can reply to the bot's own message by capturing the sendMessage response.
      await telegramSendMessage(chat.id, replyText, msg.message_id);
    } catch (err) {
      console.error(
        "Failed to send Telegram reply after ticket creation:",
        err
      );
    }

    return NextResponse.json({ ok: true, ticketId });
  } catch (err) {
    console.error("webhook error", err);
    // Keep the response simple so Telegram doesn't retry spammy updates repeatedly.
    return NextResponse.json({
      ok: false,
      error: (err as any)?.message || String(err),
    });
  }
}
