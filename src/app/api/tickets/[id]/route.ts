// app/api/tickets/[id]/route.ts
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Ticket } from "@/models/Ticket";
import { telegramSendMessage } from "@/lib/telegram";

export async function PATCH(req: Request, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  await connectToDB();

  // works whether params is a Promise<{id}> or {id}
  const { id } = await params;

  const payload = await req.json();
  const ticket = await Ticket.findOne({ ticketId: id });
  if (!ticket) return NextResponse.json({ ok: false, error: "Ticket not found" });

  if (payload.status === "COMPLETED") {
    ticket.status = "COMPLETED";
    ticket.completedAt = new Date();
    ticket.completedBy = payload.completedBy || "dashboard";
    await ticket.save();

    if (ticket.telegramChatId) {
      const msgText = `✅ <b>Ticket #${ticket.ticketId} Completed</b>\n\n` +
                     `👤 Completed by: ${ticket.completedBy}`;
      
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
