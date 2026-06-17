import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Ticket } from "@/models/Ticket";
import { Information } from "@/models/Information";
import { telegramSendMessage, escapeHTML } from "@/lib/telegram";
import { getSession } from "@/lib/auth";
import {
  notifyReopened,
  notifyStatusChange,
  notifyPriorityChange,
  notifyCategoryChange,
  notifyAgencyChange,
  notifyTicketDeleted,
} from "@/lib/notify";

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

  // In-app notification to all dashboard users (best effort)
  const session = await getSession();
  await notifyTicketDeleted(ticket, session?.userId);

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

      // In-app notification (best effort)
      const session = await getSession();
      await notifyReopened(updatedTicket || ticket, reopenedReason, session?.userId);

      return NextResponse.json({ ok: true, data: updatedTicket });
    } catch (err: any) {
      console.error("[REOPEN ERROR]:", err);
      return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
  }

  // 2. Handle COMPLETION Logic
  if (payload.status === "COMPLETED") {
    const prevStatus = ticket.status;
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
    
    if (payload.completedWithProof !== undefined) {
      ticket.completedWithProof = payload.completedWithProof;
    }
    
    if (payload.completionProofImages && Array.isArray(payload.completionProofImages)) {
      ticket.completionProofImages = payload.completionProofImages;
    }
    
    // Send Telegram Notification
    if (ticket.telegramChatId) {
      try {
        let msgText = `✅ <b>Ticket #${ticket.ticketId} Completed</b>\n\n` +
                       `📝 ${escapeHTML(ticket.description)}\n` +
                       `👤 Completed by: ${escapeHTML(ticket.completedBy)}\n` +
                       `📍 ${escapeHTML(ticket.location || "No location")}\n` +
                       `📂 ${escapeHTML(ticket.category || "Uncategorized")}`;

        if (ticket.completionProofImages && ticket.completionProofImages.length > 0) {
          msgText += `\n\n📸 <b>After-fix proof attached (${ticket.completionProofImages.length} images)</b>`;
        } else if (ticket.completionPhotos && ticket.completionPhotos.length > 0) {
          msgText += `\n\n📸 <b>After-fix photo attached</b>`;
        }

        const res = await telegramSendMessage(ticket.telegramChatId, msgText, ticket.telegramMessageId || undefined);
        
        if (res && res.ok && res.result && res.result.message_id) {
          ticket.completionMessageId = res.result.message_id;
        }
      } catch (err) {
        console.error("Failed to send Telegram notification for completion:", err);
      }
    }

    await ticket.save();

    // In-app notification (best effort)
    const session = await getSession();
    await notifyStatusChange(ticket, prevStatus, "COMPLETED", session?.userId);

    return NextResponse.json({ ok: true, data: ticket });
  }

  // 3a. Category changed to "Information" — move the record out of the Tickets
  // module into the Information section (carrying over content, all attachments
  // and key metadata), then delete the ticket so it's no longer an active ticket.
  if (
    typeof payload.category === "string" &&
    payload.category.trim().toLowerCase() === "information"
  ) {
    try {
      const session = await getSession();

      const dedupe = (arr: any[]) =>
        Array.from(new Set((arr || []).filter(Boolean)));

      const photos = dedupe([
        ...(payload.photos ?? ticket.photos ?? []),
        ...(ticket.completionPhotos ?? []),
        ...(ticket.completionProofImages ?? []),
      ]);
      const videos = dedupe([
        ...(payload.videos ?? ticket.videos ?? []),
        ...(ticket.completionVideos ?? []),
      ]);
      const documents = dedupe([
        ...(payload.documents ?? ticket.documents ?? []),
        ...(ticket.completionDocuments ?? []),
      ]);

      const baseContent = (payload.description ?? ticket.description ?? "Information")
        .toString()
        .trim();

      // Preserve metadata so nothing is lost and it's visible in Information
      const metaLines: string[] = [`— Converted from Ticket ${ticket.ticketId}`];
      const loc = payload.location ?? ticket.location;
      const prio = payload.priority ?? ticket.priority;
      const agency = payload.agencyName ?? ticket.agencyName;
      if (loc) metaLines.push(`Location: ${loc}`);
      if (prio) metaLines.push(`Priority: ${prio}`);
      if (agency && agency !== "NONE") metaLines.push(`Agency: ${agency}`);
      if (ticket.createdBy) metaLines.push(`Originally created by: ${ticket.createdBy}`);
      if (ticket.createdAt)
        metaLines.push(`Original date: ${new Date(ticket.createdAt).toLocaleString()}`);

      const content = `${baseContent}\n\n${metaLines.join("\n")}`;

      const information = await Information.create({
        content,
        createdBy: ticket.createdBy || session?.displayName || session?.username || "Dashboard Admin",
        type: "general",
        photos,
        videos,
        documents,
        telegramMessageId: ticket.telegramMessageId ?? null,
        telegramChatId: ticket.telegramChatId ?? null,
      });

      await Ticket.findByIdAndDelete(ticket._id);

      return NextResponse.json({ ok: true, kind: "information", converted: true, data: information });
    } catch (err: any) {
      console.error("[Convert to Information] Failed:", err);
      return NextResponse.json(
        { ok: false, error: err?.message || "Failed to move ticket to Information" },
        { status: 500 }
      );
    }
  }

  // 3. Handle General Field Updates — capture before/after to emit field-change events
  const before = {
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    agencyName: ticket.agencyName,
  };

  Object.assign(ticket, payload);
  await ticket.save();

  // In-app notifications for any changed fields (best effort)
  const session = await getSession();
  const actor = session?.userId;
  if (before.status !== ticket.status) {
    await notifyStatusChange(ticket, before.status, ticket.status, actor);
  }
  if (before.priority !== ticket.priority) {
    await notifyPriorityChange(ticket, before.priority, ticket.priority, actor);
  }
  if (before.category !== ticket.category) {
    await notifyCategoryChange(ticket, before.category, ticket.category, actor);
  }
  if ((before.agencyName || null) !== (ticket.agencyName || null)) {
    await notifyAgencyChange(ticket, before.agencyName ?? null, ticket.agencyName ?? null, actor);
  }

  return NextResponse.json({ ok: true, data: ticket });
}
