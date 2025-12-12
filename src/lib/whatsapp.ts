// lib/whatsapp.ts
import { ITicket } from "@/models/Ticket";
import { NotificationLog } from "@/models/NotificationLog";
import { connectToDB } from "@/lib/mongodb";

// WhatsApp Business API configuration
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v18.0";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

export interface WhatsAppResponse {
  ok: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
}

export interface NotificationContent {
  templateName: string;
  templateParams: Record<string, string>;
  fallbackMessage: string;
}

/**
 * Check if WhatsApp API is configured
 */
export function isWhatsAppConfigured(): boolean {
  return !!(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Format phone number to WhatsApp format (with country code, no + or spaces)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");
  
  // If starts with 0, assume India and replace with 91
  if (cleaned.startsWith("0")) {
    cleaned = "91" + cleaned.substring(1);
  }
  
  // If no country code (less than 12 digits), assume India
  if (cleaned.length === 10) {
    cleaned = "91" + cleaned;
  }
  
  return cleaned;
}

/**
 * Send a template message via WhatsApp Business API
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  templateParams: Record<string, string>,
  languageCode: string = "en"
): Promise<WhatsAppResponse> {
  if (!isWhatsAppConfigured()) {
    console.warn("[WhatsApp] API not configured, skipping message");
    return { ok: false, error: "WhatsApp API not configured" };
  }

  const formattedPhone = formatPhoneNumber(to);

  // Build template components from params
  const components: any[] = [];
  const paramValues = Object.values(templateParams);
  
  if (paramValues.length > 0) {
    components.push({
      type: "body",
      parameters: paramValues.map(value => ({
        type: "text",
        text: value
      }))
    });
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formattedPhone,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      components: components.length > 0 ? components : undefined
    }
  };

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json() as any;

    if (response.ok && data.messages && data.messages[0]) {
      console.log(`[WhatsApp] Template message sent to ${formattedPhone}, ID: ${data.messages[0].id}`);
      return {
        ok: true,
        messageId: data.messages[0].id
      };
    } else {
      console.error("[WhatsApp] Template send error:", data);
      return {
        ok: false,
        error: data.error?.message || "Failed to send template message",
        errorCode: data.error?.code?.toString()
      };
    }
  } catch (error: any) {
    console.error("[WhatsApp] Template send exception:", error);
    return {
      ok: false,
      error: error.message || "Network error"
    };
  }
}

/**
 * Send a text message via WhatsApp Business API (for conversations/replies)
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<WhatsAppResponse> {
  if (!isWhatsAppConfigured()) {
    console.warn("[WhatsApp] API not configured, skipping message");
    return { ok: false, error: "WhatsApp API not configured" };
  }

  const formattedPhone = formatPhoneNumber(to);

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formattedPhone,
    type: "text",
    text: {
      preview_url: false,
      body: message
    }
  };

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json() as any;

    if (response.ok && data.messages && data.messages[0]) {
      console.log(`[WhatsApp] Text message sent to ${formattedPhone}, ID: ${data.messages[0].id}`);
      return {
        ok: true,
        messageId: data.messages[0].id
      };
    } else {
      console.error("[WhatsApp] Text send error:", data);
      return {
        ok: false,
        error: data.error?.message || "Failed to send text message",
        errorCode: data.error?.code?.toString()
      };
    }
  } catch (error: any) {
    console.error("[WhatsApp] Text send exception:", error);
    return {
      ok: false,
      error: error.message || "Network error"
    };
  }
}

/**
 * Build notification content for new ticket assignment
 */
export function buildTicketAssignedMessage(ticket: ITicket): NotificationContent {
  return {
    templateName: "ticket_assigned",
    templateParams: {
      category: ticket.category || "Unknown",
      subcategory: ticket.subCategory || "N/A",
      ticket_id: ticket.ticketId,
      created_by: ticket.createdBy || "Unknown",
      description: (ticket.description || "").substring(0, 200)
    },
    fallbackMessage: `🎫 New Ticket Assigned to You\n\n` +
      `📂 Category: ${ticket.category || "Unknown"}\n` +
      `🧩 Sub Category: ${ticket.subCategory || "N/A"}\n` +
      `🆔 Ticket ID: #${ticket.ticketId}\n` +
      `👤 Created By: ${ticket.createdBy || "Unknown"}\n` +
      `📝 Description: ${(ticket.description || "").substring(0, 200)}\n\n` +
      `Please review and take action.`
  };
}

/**
 * Build reminder message for pending ticket
 */
export function buildPendingReminderMessage(
  ticket: ITicket,
  hoursElapsed: number,
  reminderCount: number
): NotificationContent {
  return {
    templateName: "ticket_reminder",
    templateParams: {
      ticket_id: ticket.ticketId,
      subcategory: ticket.subCategory || "N/A",
      hours: Math.floor(hoursElapsed).toString(),
      reminder_number: reminderCount.toString()
    },
    fallbackMessage: `⏰ Reminder #${reminderCount}: Ticket #${ticket.ticketId} (${ticket.subCategory || "N/A"}) ` +
      `is still pending for more than ${Math.floor(hoursElapsed)} hours.\n\n` +
      `📝 ${(ticket.description || "").substring(0, 150)}\n\n` +
      `Please take necessary action.`
  };
}

/**
 * Build agency visit reminder message (sent before visit date)
 */
export function buildAgencyVisitReminderMessage(
  ticket: ITicket,
  visitDate: Date
): NotificationContent {
  const dateStr = visitDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  return {
    templateName: "agency_visit_reminder",
    templateParams: {
      ticket_id: ticket.ticketId,
      visit_date: dateStr,
      location: ticket.location || "Not specified",
      category: ticket.category || "Unknown"
    },
    fallbackMessage: `📅 Visit Reminder\n\n` +
      `You are scheduled to visit on ${dateStr} for Ticket #${ticket.ticketId}.\n\n` +
      `📂 Category: ${ticket.category || "Unknown"}\n` +
      `📍 Location: ${ticket.location || "Not specified"}\n\n` +
      `Please ensure timely arrival.`
  };
}

/**
 * Build agency missed visit alert
 */
export function buildMissedVisitMessage(
  ticket: ITicket,
  scheduledDate: Date
): NotificationContent {
  const dateStr = scheduledDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  return {
    templateName: "agency_missed_visit",
    templateParams: {
      ticket_id: ticket.ticketId,
      scheduled_date: dateStr,
      category: ticket.category || "Unknown"
    },
    fallbackMessage: `⚠️ Missed Visit Alert\n\n` +
      `You missed your scheduled visit for Ticket #${ticket.ticketId} on ${dateStr}.\n\n` +
      `📂 Category: ${ticket.category || "Unknown"}\n` +
      `📍 Location: ${ticket.location || "Not specified"}\n\n` +
      `Please update your status or reschedule immediately.`
  };
}

/**
 * Send notification and create log entry
 */
export async function sendNotificationWithLog(params: {
  phone: string;
  content: NotificationContent;
  ticketId?: string;
  userId?: string;
  agencyId?: string;
  notificationMasterId?: string;
  type: "first" | "reminder" | "before_visit" | "missed_visit";
  reminderCount?: number;
}): Promise<{ ok: boolean; logId?: string; error?: string }> {
  await connectToDB();

  const {
    phone,
    content,
    ticketId,
    userId,
    agencyId,
    notificationMasterId,
    type,
    reminderCount = 1
  } = params;

  // Try template first, fall back to text message
  let response = await sendWhatsAppTemplate(
    phone,
    content.templateName,
    content.templateParams
  );

  // If template fails (maybe not approved), try text message
  if (!response.ok && response.error?.includes("template")) {
    console.log("[WhatsApp] Template failed, trying text message fallback");
    response = await sendWhatsAppMessage(phone, content.fallbackMessage);
  }

  // Create notification log
  const log = new NotificationLog({
    notificationMasterId: notificationMasterId || null,
    ticketId: ticketId || null,
    userId: userId || null,
    agencyId: agencyId || null,
    messageSid: response.messageId || null,
    recipientPhone: formatPhoneNumber(phone),
    templateId: content.templateName,
    messageContent: content.fallbackMessage,
    type,
    deliveryStatus: response.ok ? "sent" : "failed",
    failureReason: response.ok ? null : response.error,
    reminderCount,
    sentAt: new Date()
  });

  await log.save();

  return {
    ok: response.ok,
    logId: log._id?.toString(),
    error: response.error
  };
}

/**
 * Update notification log based on webhook event
 */
export async function updateNotificationStatus(
  messageSid: string,
  status: "delivered" | "read" | "failed",
  failureReason?: string
): Promise<boolean> {
  await connectToDB();

  const update: any = {
    deliveryStatus: status
  };

  if (status === "delivered") {
    update.deliveredAt = new Date();
  } else if (status === "read") {
    update.deliveryStatus = "read";
    update.readAt = new Date();
  } else if (status === "failed") {
    update.failureReason = failureReason || "Unknown error";
  }

  const result = await NotificationLog.updateOne(
    { messageSid },
    { $set: update }
  );

  return result.modifiedCount > 0;
}

/**
 * Update notification log with user reply
 */
export async function updateNotificationReply(
  messageSid: string,
  replyContent: string
): Promise<boolean> {
  await connectToDB();

  const result = await NotificationLog.updateOne(
    { messageSid },
    {
      $set: {
        replied: true,
        replyContent,
        replyAt: new Date()
      }
    }
  );

  return result.modifiedCount > 0;
}
