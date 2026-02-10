// app/api/audit-logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Ticket } from "@/models/Ticket";

export async function GET(request: NextRequest) {
  try {
    await connectToDB();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const status = searchParams.get("status"); // COMPLETED, PENDING, or all
    const user = searchParams.get("user"); // Filter by user
    const category = searchParams.get("category"); // Filter by category
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Build query
    const query: any = {};

    if (status) {
      query.status = status;
    }

    if (user) {
      query.$or = [
        { createdBy: { $regex: user, $options: "i" } },
        { completedBy: { $regex: user, $options: "i" } }
      ];
    }

    if (category) {
      query.category = { $regex: category, $options: "i" };
    }

    if (dateFrom || dateTo) {
      query.$or = query.$or || [];
      const dateQuery: any = {};
      if (dateFrom) dateQuery.$gte = new Date(dateFrom);
      if (dateTo) dateQuery.$lte = new Date(dateTo + "T23:59:59");
      
      query.$and = [
        {
          $or: [
            { createdAt: dateQuery },
            { completedAt: dateQuery }
          ]
        }
      ];
    }

    const tickets = await Ticket.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Transform tickets into audit log entries
    const auditLogs = tickets.flatMap((ticket: any) => {
      const logs = [];

      // Creation log
      logs.push({
        id: `${ticket._id}_created`,
        ticketId: ticket.ticketId,
        action: "CREATED",
        user: ticket.createdBy || "Unknown",
        timestamp: ticket.createdAt,
        details: {
          category: ticket.category,
          subCategory: ticket.subCategory,
          priority: ticket.priority,
          location: ticket.location,
          description: ticket.description,
          agencyName: ticket.agencyName,
          agencyDate: ticket.agencyDate,
          agencyTime: ticket.agencyTime,
        }
      });

      // Completion log (if completed)
      if (ticket.status === "COMPLETED" && ticket.completedAt) {
        logs.push({
          id: `${ticket._id}_completed`,
          ticketId: ticket.ticketId,
          action: "COMPLETED",
          user: ticket.completedBy || "Unknown",
          timestamp: ticket.completedAt,
          details: {
            category: ticket.category,
            subCategory: ticket.subCategory,
            priority: ticket.priority,
            location: ticket.location,
            description: ticket.description,
            completionPhotos: ticket.completionPhotos?.length || 0,
            completionVideos: ticket.completionVideos?.length || 0,
          }
        });
      }

      // Assignment log (if assigned)
      if (ticket.assignedTo && ticket.assignedAt) {
        logs.push({
          id: `${ticket._id}_assigned`,
          ticketId: ticket.ticketId,
          action: "ASSIGNED",
          user: "System",
          timestamp: ticket.assignedAt,
          details: {
            assignedTo: ticket.assignedTo,
            category: ticket.category,
          }
        });
      }

      return logs;
    });

    // Sort all logs by timestamp (most recent first)
    auditLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      success: true,
      data: auditLogs,
      total: auditLogs.length
    });
  } catch (error: any) {
    console.error("[API] Failed to fetch audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs", details: error.message },
      { status: 500 }
    );
  }
}
