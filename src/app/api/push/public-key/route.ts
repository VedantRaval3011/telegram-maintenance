// app/api/push/public-key/route.ts
import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/webpush";

/**
 * GET /api/push/public-key — returns the VAPID public key for client subscription.
 */
export async function GET() {
  const key = getVapidPublicKey();
  return NextResponse.json({ ok: !!key, publicKey: key || null });
}
