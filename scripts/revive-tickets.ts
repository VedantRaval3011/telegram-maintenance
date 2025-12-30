// scripts/revive-tickets.ts
import { Ticket } from "../src/models/Ticket";
import { connectToDB } from "../src/lib/mongodb";
import { telegramSendMessage, telegramSendPhoto, escapeHTML } from "../src/lib/telegram";
import mongoose from "mongoose";

async function revive() {
  console.log("Starting ticket revival with photos...");
  await connectToDB();

  // Find all pending tickets that might be missing from Telegram
  const pendingTickets = await Ticket.find({ status: "PENDING" }).sort({ createdAt: 1 });
  console.log(`Found ${pendingTickets.length} pending tickets.`);

  for (const ticket of pendingTickets) {
    if (!ticket.telegramChatId) {
       console.log(`Skipping ticket ${ticket.ticketId} - No chat ID found.`);
       continue;
    }

    console.log(`Reviving ticket ${ticket.ticketId}...`);

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
        console.log(`Sending photo for ${ticket.ticketId}: ${firstPhoto}${replyToId ? ` (replying to message ${replyToId})` : ''}`);
        sentMsg = await telegramSendPhoto(ticket.telegramChatId, firstPhoto, ticketMsg, replyToId);
      } else {
        // Fallback to text message if no photos
        sentMsg = await telegramSendMessage(ticket.telegramChatId, ticketMsg, replyToId);
      }

      if (sentMsg.ok && sentMsg.result) {
        ticket.telegramMessageId = sentMsg.result.message_id;
        await ticket.save();
        console.log(`Successfully revived ${ticket.ticketId}`);
        
        // If there were more media files, we could send them separately, but typically the first one is the main reference.
        // For simplicity, we send the first photo with the full ticket detail as caption.
      } else {
        console.error(`Failed to revive ${ticket.ticketId}:`, sentMsg.description);
      }
    } catch (err) {
      console.error(`Error reviving ${ticket.ticketId}:`, err);
    }
  }

  console.log("Revival complete.");
  process.exit(0);
}

revive().catch(err => {
  console.error(err);
  process.exit(1);
});
