// app/api/notifications/[id]/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { Notification } from "@/models/Notification";

/**
 * DELETE /api/notifications/[id] — delete one of the current user's notifications.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();
    const { id } = await params;

    const result = await Notification.deleteOne({
      _id: id,
      userId: session.userId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const unreadCount = await Notification.countDocuments({
      userId: session.userId,
      isRead: false,
    });

    return NextResponse.json({ ok: true, unreadCount });
  } catch (err) {
    console.error("[notifications] DELETE failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
