// app/api/tickets/purchase/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Ticket } from "@/models/Ticket";
import { User } from "@/models/User";
import { connectToDB } from "@/lib/mongodb";

// Ensure User model is registered for populate
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _UserModel = User;

/**
 * GET /api/tickets/purchase
 * Get all purchase tickets (where addOrRepairChoice = "add")
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || ""; // PENDING, COMPLETED, or empty for all
    const assigned = searchParams.get("assigned") || ""; // "true", "false", or empty for all

    // Build query
    const query: any = {
      addOrRepairChoice: "add",
    };

    if (status) {
      query.status = status;
    }

    if (assigned === "true") {
      query.assignedTo = { $ne: null };
    } else if (assigned === "false") {
      query.assignedTo = null;
    }

    // Fetch tickets with populated assignedTo
    const tickets = await Ticket.find(query)
      .populate({
        path: "assignedTo",
        select: "firstName lastName username phone",
      })
      .sort({ createdAt: -1 })
      .lean();

    // Calculate stats
    const allPurchaseTickets = await Ticket.find({ addOrRepairChoice: "add" }).lean();
    const stats = {
      total: allPurchaseTickets.length,
      pending: allPurchaseTickets.filter((t) => t.status === "PENDING").length,
      completed: allPurchaseTickets.filter((t) => t.status === "COMPLETED").length,
      assigned: allPurchaseTickets.filter((t) => t.assignedTo).length,
      unassigned: allPurchaseTickets.filter((t) => !t.assignedTo && t.status === "PENDING").length,
    };

    return NextResponse.json({
      success: true,
      data: tickets,
      stats,
    });
  } catch (err) {
    console.error("[API] Failed to fetch purchase tickets:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
