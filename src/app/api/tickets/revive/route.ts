// API endpoint to revive tickets that were deleted from Telegram
import { NextResponse } from "next/server";
import { Ticket } from "@/models/Ticket";
import { connectToDB } from "@/lib/mongodb";
import { telegramSendMessage, telegramSendPhoto, escapeHTML } from "@/lib/telegram";

export async function POST() {
  try {
    await connectToDB();

    // Find all pending tickets that might be missing from Telegram
    const pendingTickets = await Ticket.find({ status: "PENDING" }).sort({ createdAt: 1 });
    
    const results: { ticketId: string; success: boolean; error?: string }[] = [];

    for (const ticket of pendingTickets) {
      if (!ticket.telegramChatId) {
        results.push({ ticketId: ticket.ticketId, success: false, error: "No chat ID" });
        continue;
      }

      let ticketMsg = `🎫 <b>Ticket #${ticket.ticketId}</b>\n\n` +
                       `📝 ${escapeHTML(ticket.description)}\n` +
                       `📂 Category: ${escapeHTML(ticket.category || "Unknown")}\n`;
      
      if (ticket.subCategory) {
        ticketMsg += `🧩 Subcategory: ${escapeHTML(ticket.subCategory)}\n`;
      }
      
      ticketMsg += `⚡ Priority: ${escapeHTML(ticket.priority)}\n`;
      
      if (ticket.sourceLocation && ticket.targetLocation) {
        ticketMsg += `📤 From: ${escapeHTML(ticket.sourceLocation)}\n`;
        ticketMsg += `📥 To: ${escapeHTML(ticket.targetLocation)}\n`;
      } else {
        ticketMsg += `📍 Location: ${escapeHTML(ticket.location || "No location")}\n`;
      }
      
      if (ticket.agencyName && !["NONE", "__NONE__"].includes(ticket.agencyName)) {
        ticketMsg += `👷 Agency: ${escapeHTML(ticket.agencyName)}\n`;
        if (ticket.agencyDate) {
          const d = new Date(ticket.agencyDate);
          ticketMsg += `📅 Date: ${d.toLocaleDateString('en-IN')}\n`;
        }
        if (ticket.agencyTime) {
          ticketMsg += `⏰ Time: ${escapeHTML(ticket.agencyTime)}\n`;
        }
      }
      
      const photoCount = ticket.photos?.length || 0;
      const videoCount = ticket.videos?.length || 0;
      if (photoCount > 0 || videoCount > 0) {
        let mediaInfo = '';
        if (photoCount > 0) mediaInfo += `📸 ${photoCount} photo${photoCount > 1 ? 's' : ''}`;
        if (photoCount > 0 && videoCount > 0) mediaInfo += ' • ';
        if (videoCount > 0) mediaInfo += `🎬 ${videoCount} video${videoCount > 1 ? 's' : ''}`;
        ticketMsg += `${mediaInfo}\n`;
      }
      
      ticketMsg += `👤 Created by: ${escapeHTML(ticket.createdBy || "Unknown")}`;

      try {
        let sentMsg;
        
        // Reply to the original message if available - this makes the ticket appear right after the original photo
        const replyToId = ticket.originalMessageId || undefined;
        
        // If there's at least one photo, send the first one with the description as caption
        if (ticket.photos && ticket.photos.length > 0) {
          const firstPhoto = ticket.photos[0];
          sentMsg = await telegramSendPhoto(ticket.telegramChatId, firstPhoto, ticketMsg, replyToId);
        } else {
          // Fallback to text message if no photos
          sentMsg = await telegramSendMessage(ticket.telegramChatId, ticketMsg, replyToId);
        }

        if (sentMsg.ok && sentMsg.result) {
          ticket.telegramMessageId = sentMsg.result.message_id;
          await ticket.save();
          results.push({ ticketId: ticket.ticketId, success: true });
        } else {
          results.push({ ticketId: ticket.ticketId, success: false, error: sentMsg.description });
        }
      } catch (err: any) {
        results.push({ ticketId: ticket.ticketId, success: false, error: err.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      message: `Revived ${successCount} tickets, ${failCount} failed`,
      total: pendingTickets.length,
      results
    });
  } catch (err: any) {
    console.error("Revive tickets error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
