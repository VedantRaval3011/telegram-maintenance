// app/api/push/subscribe/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { PushSubscription } from "@/models/PushSubscription";

/**
 * POST /api/push/subscribe
 * Body: a browser PushSubscription JSON { endpoint, keys: { p256dh, auth } }.
 * Upserts the subscription for the current user (one doc per endpoint/device).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();

    const body = await req.json();
    const { endpoint, keys } = body || {};

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { ok: false, error: "Invalid subscription" },
        { status: 400 }
      );
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        $set: {
          userId: session.userId,
          endpoint,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
          userAgent: req.headers.get("user-agent") || null,
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push] subscribe failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
