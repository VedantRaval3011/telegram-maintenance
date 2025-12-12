// app/api/webhook/whatsapp/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { NotificationLog } from "@/models/NotificationLog";
import { updateNotificationStatus, updateNotificationReply } from "@/lib/whatsapp";

const WHATSAPP_WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "";

/**
 * WhatsApp Webhook Verification (GET)
 * Meta requires this for webhook setup
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("[WhatsApp Webhook] Verification request:", { mode, token, challenge });

  if (mode === "subscribe" && token === WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log("[WhatsApp Webhook] Verification successful");
    return new NextResponse(challenge, { status: 200 });
  } else {
    console.error("[WhatsApp Webhook] Verification failed - token mismatch");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

/**
 * WhatsApp Webhook Events (POST)
 * Receives delivery status updates, read receipts, and user replies
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log("[WhatsApp Webhook] Received event:", JSON.stringify(body, null, 2));

    await connectToDB();

    // Process webhook entries
    const entries = body.entry || [];
    
    for (const entry of entries) {
      const changes = entry.changes || [];
      
      for (const change of changes) {
        if (change.field !== "messages") continue;
        
        const value = change.value;
        
        // Handle status updates (delivery, read, failed)
        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            await handleStatusUpdate(status);
          }
        }
        
        // Handle incoming messages (user replies)
        if (value.messages && value.messages.length > 0) {
          for (const message of value.messages) {
            await handleIncomingMessage(message, value.contacts);
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[WhatsApp Webhook] Error processing event:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Handle status update events (delivered, read, failed)
 */
async function handleStatusUpdate(status: any) {
  const messageSid = status.id;
  const statusType = status.status;
  const timestamp = status.timestamp;
  const recipientId = status.recipient_id;

  console.log(`[WhatsApp Webhook] Status update: ${messageSid} -> ${statusType}`);

  try {
    switch (statusType) {
      case "sent":
        await updateNotificationStatus(messageSid, "delivered");
        console.log(`[WhatsApp Webhook] Message ${messageSid} marked as sent`);
        break;
        
      case "delivered":
        await updateNotificationStatus(messageSid, "delivered");
        console.log(`[WhatsApp Webhook] Message ${messageSid} delivered`);
        break;
        
      case "read":
        await updateNotificationStatus(messageSid, "read");
        console.log(`[WhatsApp Webhook] Message ${messageSid} read`);
        break;
        
      case "failed":
        const errorInfo = status.errors?.[0];
        const failureReason = errorInfo 
          ? `${errorInfo.code}: ${errorInfo.title} - ${errorInfo.message}`
          : "Unknown failure";
        await updateNotificationStatus(messageSid, "failed", failureReason);
        console.error(`[WhatsApp Webhook] Message ${messageSid} failed: ${failureReason}`);
        break;
        
      default:
        console.log(`[WhatsApp Webhook] Unknown status type: ${statusType}`);
    }
  } catch (error) {
    console.error(`[WhatsApp Webhook] Error updating status for ${messageSid}:`, error);
  }
}

/**
 * Handle incoming messages (user/agency replies)
 */
async function handleIncomingMessage(message: any, contacts: any[]) {
  const from = message.from; // Phone number
  const messageId = message.id;
  const messageType = message.type;
  const timestamp = message.timestamp;

  console.log(`[WhatsApp Webhook] Incoming message from ${from}, type: ${messageType}`);

  // Extract message content
  let replyContent = "";
  
  switch (messageType) {
    case "text":
      replyContent = message.text?.body || "";
      break;
    case "button":
      replyContent = message.button?.text || "";
      break;
    case "interactive":
      replyContent = message.interactive?.button_reply?.title || 
                     message.interactive?.list_reply?.title || "";
      break;
    case "image":
      replyContent = "[Image received]";
      break;
    case "document":
      replyContent = "[Document received]";
      break;
    case "video":
      replyContent = "[Video received]";
      break;
    default:
      replyContent = `[${messageType} received]`;
  }

  // Get contact name if available
  const contact = contacts?.find((c: any) => c.wa_id === from);
  const contactName = contact?.profile?.name || "Unknown";

  console.log(`[WhatsApp Webhook] Reply from ${contactName} (${from}): ${replyContent}`);

  try {
    // Find the most recent notification sent to this phone number
    const recentLog = await NotificationLog.findOne({
      recipientPhone: from,
      deliveryStatus: { $in: ["sent", "delivered", "read"] }
    }).sort({ sentAt: -1 });

    if (recentLog) {
      // Update the log with reply information
      recentLog.replied = true;
      recentLog.replyContent = replyContent;
      recentLog.replyAt = new Date();
      await recentLog.save();
      
      console.log(`[WhatsApp Webhook] Updated log ${recentLog._id} with reply`);
      
      // TODO: Trigger any follow-up actions based on reply content
      // For example, if user replies "done" or "completed", could update ticket status
      await handleReplyAction(recentLog, replyContent);
    } else {
      console.log(`[WhatsApp Webhook] No recent notification found for ${from}`);
      
      // Still log the incoming message for reference
      const orphanLog = new NotificationLog({
        recipientPhone: from,
        messageContent: `[Unsolicited reply] ${replyContent}`,
        type: "first",
        deliveryStatus: "delivered",
        replied: true,
        replyContent,
        replyAt: new Date(),
        sentAt: new Date()
      });
      await orphanLog.save();
    }
  } catch (error) {
    console.error(`[WhatsApp Webhook] Error handling reply from ${from}:`, error);
  }
}

/**
 * Handle actions based on reply content
 */
async function handleReplyAction(log: any, replyContent: string) {
  const normalizedReply = replyContent.toLowerCase().trim();
  
  // Check for acknowledgment replies
  const ackKeywords = ["ok", "okay", "done", "noted", "will do", "on it", "acknowledged"];
  const isAcknowledged = ackKeywords.some(kw => normalizedReply.includes(kw));
  
  if (isAcknowledged) {
    console.log(`[WhatsApp Webhook] Acknowledgment detected for ticket ${log.ticketId}`);
    // Could update ticket status or add a note
    // For now, just log it
  }
  
  // Check for completion replies
  const completeKeywords = ["completed", "fixed", "resolved", "finished"];
  const isCompleted = completeKeywords.some(kw => normalizedReply.includes(kw));
  
  if (isCompleted && log.ticketId) {
    console.log(`[WhatsApp Webhook] Completion reply detected for ticket ${log.ticketId}`);
    // TODO: Could auto-complete the ticket or notify for review
  }
}
