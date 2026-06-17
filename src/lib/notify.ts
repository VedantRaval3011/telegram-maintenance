// lib/notify.ts
import { connectToDB } from "./mongodb";
import { AdminUser } from "@/models/AdminUser";
import { Notification, NotificationType } from "@/models/Notification";
import { PushSubscription } from "@/models/PushSubscription";
import { sendPush } from "./webpush";

interface TicketLike {
  _id?: any;
  ticketId?: string;
  description?: string | null;
  category?: string | null;
  location?: string | null;
  priority?: string | null;
}

interface EmitOptions {
  ticket: TicketLike;
  type: NotificationType;
  title: string;
  message: string;
  meta?: Record<string, any>;
  /** AdminUser._id of the person who caused the event; excluded from recipients. */
  actorUserId?: string | null;
}

/**
 * Core fan-out. Creates one Notification per active AdminUser (minus the actor)
 * and best-effort Web Push to each recipient's devices. Never throws — callers
 * wrap ticket mutations and must not break if notifications fail.
 */
export async function createNotifications(opts: EmitOptions): Promise<void> {
  const { ticket, type, title, message, meta = {}, actorUserId } = opts;

  try {
    await connectToDB();

    const recipients = await AdminUser.find({ isActive: true })
      .select("_id")
      .lean();

    const recipientIds = recipients
      .map((u: any) => u._id)
      .filter((id: any) => !actorUserId || id.toString() !== actorUserId);

    if (recipientIds.length === 0) return;

    const ticketDisplayId = ticket.ticketId || null;
    const ticketObjectId = ticket._id || null;

    const docs = recipientIds.map((userId: any) => ({
      userId,
      ticketId: ticketObjectId,
      ticketDisplayId,
      title,
      message,
      type,
      isRead: false,
      meta,
    }));

    await Notification.insertMany(docs, { ordered: false });

    // Best-effort Web Push to all recipient devices.
    await sendPushToUsers(recipientIds, {
      title,
      body: message,
      type,
      ticketDisplayId,
      ticketId: ticketObjectId ? ticketObjectId.toString() : null,
    });
  } catch (err) {
    console.error("[notify] createNotifications failed:", err);
  }
}

async function sendPushToUsers(
  userIds: any[],
  payload: Record<string, any>
): Promise<void> {
  try {
    const subs = await PushSubscription.find({ userId: { $in: userIds } }).lean();
    if (subs.length === 0) return;

    const goneEndpoints: string[] = [];

    await Promise.all(
      subs.map(async (sub: any) => {
        const res = await sendPush(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        );
        if (res.gone) goneEndpoints.push(sub.endpoint);
      })
    );

    if (goneEndpoints.length > 0) {
      await PushSubscription.deleteMany({ endpoint: { $in: goneEndpoints } });
    }
  } catch (err) {
    console.error("[notify] push fan-out failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Event-specific helpers — keep title/message templates in one place.
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  COMPLETED: "Completed",
};

function statusLabel(status?: string | null): string {
  if (!status) return "Unknown";
  return STATUS_LABELS[status] || status;
}

function tid(ticket: TicketLike): string {
  return ticket.ticketId ? `Ticket ${ticket.ticketId}` : "Ticket";
}

export function notifyTicketCreated(ticket: TicketLike, actorUserId?: string | null) {
  return createNotifications({
    ticket,
    type: "ticket_created",
    title: `🆕 ${tid(ticket)} created`,
    message: `${ticket.description || "New ticket"}${
      ticket.location ? ` · ${ticket.location}` : ""
    }`,
    meta: { category: ticket.category, priority: ticket.priority },
    actorUserId,
  });
}

export function notifyTicketAssigned(
  ticket: TicketLike,
  assigneeName: string,
  actorUserId?: string | null
) {
  return createNotifications({
    ticket,
    type: "ticket_assigned",
    title: `👤 ${tid(ticket)} assigned`,
    message: `Assigned to ${assigneeName}`,
    meta: { assignee: assigneeName },
    actorUserId,
  });
}

export function notifyStatusChange(
  ticket: TicketLike,
  fromStatus: string | null,
  toStatus: string | null,
  actorUserId?: string | null
) {
  const completed = toStatus === "COMPLETED";
  return createNotifications({
    ticket,
    type: "status_change",
    title: `${completed ? "✔️" : "🔄"} ${tid(ticket)} → ${statusLabel(toStatus)}`,
    message: `Status changed from ${statusLabel(fromStatus)} to ${statusLabel(
      toStatus
    )}`,
    meta: { fromStatus, toStatus },
    actorUserId,
  });
}

export function notifyReopened(
  ticket: TicketLike,
  reason?: string | null,
  actorUserId?: string | null
) {
  return createNotifications({
    ticket,
    type: "reopened",
    title: `🔁 ${tid(ticket)} reopened`,
    message: reason ? `Reason: ${reason}` : "Ticket has been reopened",
    meta: { reason },
    actorUserId,
  });
}

export function notifyPriorityChange(
  ticket: TicketLike,
  fromPriority: string | null,
  toPriority: string | null,
  actorUserId?: string | null
) {
  return createNotifications({
    ticket,
    type: "priority_change",
    title: `⚡ ${tid(ticket)} priority changed`,
    message: `Priority: ${fromPriority || "—"} → ${toPriority || "—"}`,
    meta: { fromPriority, toPriority },
    actorUserId,
  });
}

export function notifyCategoryChange(
  ticket: TicketLike,
  fromCategory: string | null,
  toCategory: string | null,
  actorUserId?: string | null
) {
  return createNotifications({
    ticket,
    type: "category_change",
    title: `🏷️ ${tid(ticket)} category changed`,
    message: `Category: ${fromCategory || "—"} → ${toCategory || "—"}`,
    meta: { fromCategory, toCategory },
    actorUserId,
  });
}

export function notifyAgencyChange(
  ticket: TicketLike,
  fromAgency: string | null,
  toAgency: string | null,
  actorUserId?: string | null
) {
  return createNotifications({
    ticket,
    type: "agency_change",
    title: `🏢 ${tid(ticket)} agency changed`,
    message: `Agency: ${fromAgency || "None"} → ${toAgency || "None"}`,
    meta: { fromAgency, toAgency },
    actorUserId,
  });
}

export function notifyTicketDeleted(ticket: TicketLike, actorUserId?: string | null) {
  return createNotifications({
    ticket,
    type: "ticket_deleted",
    title: `🗑️ ${tid(ticket)} deleted`,
    message: `${ticket.description || "Ticket"} was removed`,
    meta: {},
    actorUserId,
  });
}
