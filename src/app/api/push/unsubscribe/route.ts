// app/api/push/unsubscribe/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { PushSubscription } from "@/models/PushSubscription";

/**
 * POST /api/push/unsubscribe
 * Body: { endpoint }. Removes the subscription for the current user.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();

    const { endpoint } = (await req.json()) || {};
    if (!endpoint) {
      return NextResponse.json({ ok: false, error: "endpoint required" }, { status: 400 });
    }

    await PushSubscription.deleteOne({ endpoint, userId: session.userId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push] unsubscribe failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
