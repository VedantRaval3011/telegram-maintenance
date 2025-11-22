// app/api/tickets/[id]/route.ts
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Ticket } from "@/models/Ticket";
import { telegramSendMessage } from "@/lib/telegram";

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
  } else {
    Object.assign(ticket, payload);
    await ticket.save();
  }
  
  return NextResponse.json({ ok: true, data: ticket });
}