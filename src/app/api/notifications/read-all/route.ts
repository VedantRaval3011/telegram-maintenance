// app/api/notifications/read-all/route.ts
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { Notification } from "@/models/Notification";

/**
 * POST /api/notifications/read-all — mark all of the current user's notifications read.
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();

    await Notification.updateMany(
      { userId: session.userId, isRead: false },
      { $set: { isRead: true } }
    );

    return NextResponse.json({ ok: true, unreadCount: 0 });
  } catch (err) {
    console.error("[notifications] read-all failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
