// app/api/cron/notifications/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { runNotificationScheduler } from "@/lib/notificationScheduler";

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * Cron endpoint for running notification scheduler
 * 
 * This should be called periodically (every 15 minutes recommended)
 * by an external cron service or Vercel Cron Jobs
 * 
 * Security: Requires CRON_SECRET header or query param
 */
export async function GET(req: NextRequest) {
  try {
    // Security check - verify cron secret
    const authHeader = req.headers.get("authorization");
    const querySecret = req.nextUrl.searchParams.get("secret");
    
    const providedSecret = authHeader?.replace("Bearer ", "") || querySecret;
    
    // If CRON_SECRET is set, validate it
    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
      console.error("[Cron] Unauthorized request - invalid secret");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[Cron] Starting notification scheduler run...");
    
    const result = await runNotificationScheduler();

    console.log("[Cron] Scheduler completed:", result);

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error: any) {
    console.error("[Cron] Scheduler error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for manual trigger with options
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { secret, runOnly } = body;

    // Security check
    if (CRON_SECRET && secret !== CRON_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[Cron] Manual trigger with options:", { runOnly });

    const result = await runNotificationScheduler();

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error: any) {
    console.error("[Cron] Manual trigger error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
