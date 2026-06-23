// app/api/tickets/create/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Ticket } from "@/models/Ticket";
import { Category } from "@/models/Category";
import { SubCategory } from "@/models/SubCategoryMaster";
import { getEffectiveSession, canAddTicket } from "@/lib/auth";
import { triggerTicketCreatedNotification } from "@/lib/notificationScheduler";
import { notifyTicketCreated } from "@/lib/notify";
import { Information } from "@/models/Information";

/**
 * POST /api/tickets/create
 *
 * Dashboard counterpart of the Telegram wizard (see createTicketFromSession in
 * app/api/webhook/route.ts). Accepts the flattened wizard form and creates a
 * ticket with the same fields, ticket-id generation and notification trigger.
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDB();

    const session = await getEffectiveSession();
    if (!session || !canAddTicket(session)) {
      return NextResponse.json(
        { ok: false, error: "You do not have permission to add tickets" },
        { status: 403 }
      );
    }

    const body = await req.json();

    const {
      description,
      categoryId,
      subCategoryId,
      priority,
      location,
      sourceLocation,
      targetLocation,
      addOrRepairChoice,
      agencyRequired,
      agencyName,
      agencyDate,
      agencyTime,
      additionalFields,
      photos,
      videos,
      documents,
    } = body;

    if (!categoryId) {
      return NextResponse.json(
        { ok: false, error: "Category is required" },
        { status: 400 }
      );
    }

    const category = await Category.findById(categoryId).lean();
    if (!category) {
      return NextResponse.json(
        { ok: false, error: "Category not found" },
        { status: 404 }
      );
    }

    // If the chosen category is the special "Information" category, store the entry
    // in the Information module instead of creating a maintenance ticket (mirrors
    // the Telegram wizard behaviour).
    if (category.name?.toLowerCase() === "information") {
      const createdByName =
        session?.displayName || session?.username || "Dashboard Admin";
      const information = await Information.create({
        content: (description && description.trim()) || "Information",
        createdBy: createdByName,
        type: "general",
        photos: Array.isArray(photos) ? photos : [],
        videos: Array.isArray(videos) ? videos : [],
        documents: Array.isArray(documents) ? documents : [],
      });
      return NextResponse.json({ ok: true, kind: "information", data: information });
    }

    const subcategory = subCategoryId
      ? await SubCategory.findById(subCategoryId).lean()
      : null;

    // Generate next ticket ID (mirrors webhook logic)
    const lastTicket = await Ticket.findOne().sort({ createdAt: -1 }).lean();
    let nextTicketNumber = 1;
    if (lastTicket && lastTicket.ticketId) {
      const match = lastTicket.ticketId.match(/T(\d+)/);
      if (match) {
        nextTicketNumber = parseInt(match[1]) + 1;
      }
    }
    const nextTicketId = `T${nextTicketNumber}`;

    const createdBy = session?.displayName || session?.username || "Dashboard Admin";

    const ticketData: any = {
      ticketId: nextTicketId,
      description: (description && description.trim()) || "No description",
      category: category.name || "unknown",
      categoryDisplay: category.displayName || "Unknown",
      subCategory: subcategory?.name || null,
      priority: priority || "medium",
      location: location || "Not specified",
      status: "PENDING",
      createdBy,
      photos: Array.isArray(photos) ? photos : [],
      videos: Array.isArray(videos) ? videos : [],
      documents: Array.isArray(documents) ? documents : [],
      additionalFields: additionalFields || {},
    };

    // Agency info
    if (agencyRequired) {
      const isNoAgency =
        !agencyName || agencyName === "__NONE__" || agencyName === "NONE";
      ticketData.agencyName = isNoAgency ? "NONE" : agencyName;

      if (!isNoAgency) {
        if (agencyTime) ticketData.agencyTime = agencyTime;
        if (agencyDate) ticketData.agencyDate = agencyDate;
      }
    }

    // Source/target locations (transfer-style categories)
    if (sourceLocation) ticketData.sourceLocation = sourceLocation;
    if (targetLocation) ticketData.targetLocation = targetLocation;

    // Add or Repair choice
    if (addOrRepairChoice) ticketData.addOrRepairChoice = addOrRepairChoice;

    const ticket = await Ticket.create(ticketData);

    // Trigger external (Telegram/WhatsApp) notification (best effort)
    try {
      await triggerTicketCreatedNotification(ticket);
    } catch (notifyError) {
      console.error("[Create Ticket] Failed to trigger notification:", notifyError);
    }

    // In-app notification to all dashboard users (best effort)
    await notifyTicketCreated(ticket, session?.userId);

    return NextResponse.json({ ok: true, data: ticket });
  } catch (err) {
    console.error("[Create Ticket] Failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
