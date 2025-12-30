// app/api/tickets/[id]/route.ts
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Ticket } from "@/models/Ticket";
import { telegramSendMessage } from "@/lib/telegram";

export async function DELETE(req: Request, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  await connectToDB();

  const { id } = await params;
  
  // Try to find by MongoDB _id first, then by ticketId
  let ticket = await Ticket.findById(id).catch(() => null);
  if (!ticket) {
    ticket = await Ticket.findOne({ ticketId: id });
  }
  
  if (!ticket) {
    return NextResponse.json({ ok: false, error: "Ticket not found" }, { status: 404 });
  }

  // Send Telegram notification about deletion before deleting
  if (ticket.telegramChatId) {
    try {
      const msgText = `🗑️ <b>Ticket #${ticket.ticketId} Deleted</b>\n\n` +
                     `📝 ${ticket.description}\n` +
                     `📂 ${ticket.category || "Unknown"}\n` +
                     `📍 ${ticket.location || "No location"}\n\n` +
                     `This ticket has been removed from the system.`;
      
      await telegramSendMessage(
        ticket.telegramChatId, 
        msgText,
        ticket.telegramMessageId || undefined
      );
    } catch (err) {
      console.error("Failed to send Telegram notification for deletion:", err);
      // Continue with deletion even if notification fails
    }
  }

  // Delete the ticket
  await Ticket.findByIdAndDelete(ticket._id);
  
  return NextResponse.json({ ok: true, message: "Ticket deleted successfully" });
}

export async function PATCH(req: Request, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  await connectToDB();

  const { id } = await params;
  const payload = await req.json();
  const ticket = await Ticket.findOne({ ticketId: id });
  
  if (!ticket) return NextResponse.json({ ok: false, error: "Ticket not found" });

  if (payload.status === "COMPLETED") {
    ticket.status = "COMPLETED";
    ticket.completedAt = new Date();
    ticket.completedBy = payload.completedBy || "dashboard";
    
    // ✅ Handle completion photos with proper null check
    if (payload.completionPhotos && Array.isArray(payload.completionPhotos)) {
      ticket.completionPhotos = payload.completionPhotos;
    }
    
    await ticket.save();

    if (ticket.telegramChatId) {
      let msgText = `✅ <b>Ticket #${ticket.ticketId} Completed</b>\n\n` +
                   `👤 Completed by: ${ticket.completedBy}`;
      
      // ✅ Safe length check
      if (ticket.completionPhotos && ticket.completionPhotos.length > 0) {
        msgText += `\n📸 After-fix photos: ${ticket.completionPhotos.length}`;
      }
      
      await telegramSendMessage(
        ticket.telegramChatId, 
        msgText,
        ticket.telegramMessageId || undefined
      );
    }
  } else if (payload.status === "PENDING" && payload.reopen) {
    // ✅ Handle ticket reopen
    ticket.status = "PENDING";
    ticket.completedBy = null;
    ticket.completedAt = null;
    // Keep completion photos for reference but could clear if needed
    
    await ticket.save();

    // Send Telegram notification about reopening
    if (ticket.telegramChatId) {
      const reopenedBy = payload.reopenedBy || "Dashboard";
      const msgText = `🔄 <b>Ticket #${ticket.ticketId} Reopened</b>\n\n` +
                     `📝 ${ticket.description}\n` +
                     `📂 ${ticket.category || "Unknown"}\n` +
                     `📍 ${ticket.location || "No location"}\n\n` +
                     `👤 Reopened by: ${reopenedBy}`;
      
      await telegramSendMessage(
        ticket.telegramChatId, 
        msgText,
        ticket.telegramMessageId || undefined
      );
    }
  } else {
    Object.assign(ticket, payload);
    await ticket.save();
  }
  
  return NextResponse.json({ ok: true, data: ticket });
}