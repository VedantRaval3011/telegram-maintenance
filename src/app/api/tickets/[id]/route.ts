import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Ticket } from "@/models/Ticket";
import { telegramSendMessage, escapeHTML } from "@/lib/telegram";

export async function GET(req: Request, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  await connectToDB();
  const { id } = await params;
  let ticket = await Ticket.findById(id).catch(() => null);
  if (!ticket) {
    ticket = await Ticket.findOne({ ticketId: id });
  }
  if (!ticket) return NextResponse.json({ ok: false, error: "Ticket not found" }, { status: 404 });
  return NextResponse.json({ ok: true, data: ticket });
}

export async function DELETE(req: Request, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  await connectToDB();
  const { id } = await params;
  let ticket = await Ticket.findById(id).catch(() => null);
  if (!ticket) {
    ticket = await Ticket.findOne({ ticketId: id });
  }
  if (!ticket) return NextResponse.json({ ok: false, error: "Ticket not found" }, { status: 404 });

  if (ticket.telegramChatId) {
    try {
      const msgText = `🗑️ <b>Ticket #${ticket.ticketId} Deleted</b>\n\n` +
                     `📝 ${escapeHTML(ticket.description)}\n` +
                     `📂 ${escapeHTML(ticket.category || "Unknown")}\n` +
                     `📍 ${escapeHTML(ticket.location || "No location")}\n\n` +
                     `This ticket has been removed from the system.`;
      await telegramSendMessage(ticket.telegramChatId, msgText, ticket.telegramMessageId || undefined);
    } catch (err) {
      console.error("Failed to send Telegram notification for deletion:", err);
    }
  }

  await Ticket.findByIdAndDelete(ticket._id);
  return NextResponse.json({ ok: true, message: "Ticket deleted successfully" });
}

export async function PATCH(req: Request, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  await connectToDB();
  const { id } = await params;
  const payload = await req.json();
  
  let ticket = await Ticket.findById(id).catch(() => null);
  if (!ticket) {
    ticket = await Ticket.findOne({ ticketId: id });
  }
  
  if (!ticket) return NextResponse.json({ ok: false, error: "Ticket not found" });

  // 1. Handle REOPEN Logic (Priority)
  if (payload.reopen === true || payload.reopen === "true") {
    try {
      const reopenedBy = payload.reopenedBy || "Dashboard";
      const reopenedReason = payload.reopenedReason || "Not specified";
      
      const startTime = (ticket.reopenedHistory && ticket.reopenedHistory.length > 0) 
        ? ticket.reopenedHistory[ticket.reopenedHistory.length - 1].completedAtAfterReopening 
        : ticket.completedAt || ticket.createdAt;
      
      const phaseDuration = startTime ? (Date.now() - new Date(startTime).getTime()) : 0;

      const historyEntry = {
        reopenedAt: new Date(),
        reopenedBy: reopenedBy,
        reopenedReason: reopenedReason,
        previousStatus: ticket.status,
        previousCompletedAt: ticket.completedAt,
        previousCompletedBy: ticket.completedBy,
        phaseDuration: phaseDuration
      };

      // Use findOneAndUpdate with runValidators: false to be fast and bypass schema strictly if needed, but safe
      const updatedTicket = await Ticket.findOneAndUpdate(
        { _id: ticket._id },
        { 
          $push: { reopenedHistory: historyEntry as any },
          $set: { 
            status: "PENDING", 
            completedBy: null, 
            completedAt: null 
          } 
        },
        { new: true }
      );

      if (updatedTicket && updatedTicket.telegramChatId) {
        const msgText = `🔄 <b>Ticket #${updatedTicket.ticketId} Reopened</b>\n\n` +
                       `👤 Reopened by: ${escapeHTML(reopenedBy)}\n` +
                       `❓ Reason: ${escapeHTML(reopenedReason)}`;
        await telegramSendMessage(updatedTicket.telegramChatId, msgText, updatedTicket.telegramMessageId || undefined).catch(() => {});
      }
      
      return NextResponse.json({ ok: true, data: updatedTicket });
    } catch (err: any) {
      console.error("[REOPEN ERROR]:", err);
      return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
  }

  // 2. Handle COMPLETION Logic
  if (payload.status === "COMPLETED") {
    const wasReopened = ticket.reopenedHistory && ticket.reopenedHistory.length > 0;
    const lastReopening = wasReopened ? ticket.reopenedHistory[ticket.reopenedHistory.length - 1] : null;

    ticket.status = "COMPLETED";
    ticket.completedAt = new Date();
    ticket.completedBy = payload.completedBy || "dashboard";
    
    if (lastReopening && !lastReopening.completedAtAfterReopening) {
      lastReopening.completedAtAfterReopening = ticket.completedAt;
      lastReopening.completedByAfterReopening = ticket.completedBy;
      ticket.markModified('reopenedHistory');
    }

    if (payload.completionPhotos && Array.isArray(payload.completionPhotos)) {
      ticket.completionPhotos = payload.completionPhotos;
    }
    
    await ticket.save();
    return NextResponse.json({ ok: true, data: ticket });
  }

  // 3. Handle General Field Updates
  Object.assign(ticket, payload);
  await ticket.save();
  return NextResponse.json({ ok: true, data: ticket });
}
