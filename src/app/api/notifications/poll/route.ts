// app/api/notifications/poll/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { Notification } from "@/models/Notification";

/**
 * GET /api/notifications/poll?since=<ISO updatedAt>
 *
 * Lightweight real-time backbone. Returns notifications whose `updatedAt` is
 * strictly after `since` (cursor) plus the current unread count. Using
 * `updatedAt` means the delta carries BOTH brand-new notifications and
 * read-state changes made on other devices — so multi-device read sync works
 * with no extra round-trips. Cursor-based delta means no duplicates and no lost
 * notifications across reconnects. If `since` is omitted, returns the latest
 * batch (initial sync).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();

    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since");

    const query: Record<string, any> = { userId: session.userId };
    if (since) {
      const sinceDate = new Date(since);
      if (!Number.isNaN(sinceDate.getTime())) {
        query.updatedAt = { $gt: sinceDate };
      }
    }

    // Cap the delta to avoid a flood after long offline periods; the client
    // can full-resync via GET /api/notifications if it ever sees a gap.
    const items = await Notification.find(query)
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await Notification.countDocuments({
      userId: session.userId,
      isRead: false,
    });

    const serverTime = new Date().toISOString();

    return NextResponse.json({ ok: true, items, unreadCount, serverTime });
  } catch (err) {
    console.error("[notifications] poll failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
