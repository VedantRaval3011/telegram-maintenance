// app/api/notifications/logs/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { NotificationLog } from "@/models/NotificationLog";
import mongoose from "mongoose";

/**
 * GET - List notification logs with filters
 * Query params: ticketId, userId, agencyId, status, type, from, to, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDB();

    const searchParams = req.nextUrl.searchParams;
    const ticketId = searchParams.get("ticketId");
    const userId = searchParams.get("userId");
    const agencyId = searchParams.get("agencyId");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Build query filter
    const filter: any = {};
    
    if (ticketId) {
      filter.ticketId = new mongoose.Types.ObjectId(ticketId);
    }
    if (userId) {
      filter.userId = new mongoose.Types.ObjectId(userId);
    }
    if (agencyId) {
      filter.agencyId = new mongoose.Types.ObjectId(agencyId);
    }
    if (status) {
      filter.deliveryStatus = status;
    }
    if (type) {
      filter.type = type;
    }
    
    // Date range filter
    if (from || to) {
      filter.sentAt = {};
      if (from) filter.sentAt.$gte = new Date(from);
      if (to) filter.sentAt.$lte = new Date(to);
    }

    // Get total count for pagination
    const total = await NotificationLog.countDocuments(filter);

    // Get paginated results
    const logs = await NotificationLog.find(filter)
      .populate("notificationMasterId", "type reminderAfterHours notifyBeforeDays")
      .populate("ticketId", "ticketId description category subCategory")
      .populate("userId", "firstName lastName username")
      .populate("agencyId", "name")
      .sort({ sentAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      ok: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error("[Notification Logs API] GET error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

/**
 * GET stats for notifications
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDB();

    const body = await req.json();
    const { action } = body;

    if (action === "stats") {
      // Get overall statistics
      const stats = await NotificationLog.aggregate([
        {
          $group: {
            _id: "$deliveryStatus",
            count: { $sum: 1 }
          }
        }
      ]);

      const typeStats = await NotificationLog.aggregate([
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 }
          }
        }
      ]);

      const replyStats = await NotificationLog.aggregate([
        {
          $group: {
            _id: "$replied",
            count: { $sum: 1 }
          }
        }
      ]);

      // Recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentActivity = await NotificationLog.aggregate([
        {
          $match: {
            sentAt: { $gte: sevenDaysAgo }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$sentAt" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      return NextResponse.json({
        ok: true,
        data: {
          byStatus: stats,
          byType: typeStats,
          byReply: replyStats,
          recentActivity
        }
      });
    }

    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("[Notification Logs API] POST error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
