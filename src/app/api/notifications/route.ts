// app/api/notifications/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { Notification } from "@/models/Notification";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * GET /api/notifications?cursor=<ISO createdAt>&limit=20
 * Paginated history for the current user, newest first.
 * Returns { items, nextCursor, unreadCount }.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(
      parseInt(searchParams.get("limit") || `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT,
      MAX_LIMIT
    );

    const query: Record<string, any> = { userId: session.userId };
    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!Number.isNaN(cursorDate.getTime())) {
        query.createdAt = { $lt: cursorDate };
      }
    }

    const items = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const extra = items.pop();
      nextCursor = extra ? new Date(items[items.length - 1].createdAt).toISOString() : null;
    }

    const unreadCount = await Notification.countDocuments({
      userId: session.userId,
      isRead: false,
    });

    return NextResponse.json({ ok: true, items, nextCursor, unreadCount });
  } catch (err) {
    console.error("[notifications] GET failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
