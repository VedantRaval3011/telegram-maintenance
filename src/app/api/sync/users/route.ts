// app/api/sync/users/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { syncTelegramUsers, syncLocationsFromTickets } from "@/services/syncService";
import { z } from "zod";

/**
 * Request body schema
 */
const SyncRequestSchema = z.object({
  chatId: z.number().optional(),
  syncLocations: z.boolean().optional().default(false),
});

/**
 * POST /api/sync/users
 * 
 * Manually trigger Telegram user sync
 * 
 * Request body:
 * {
 *   "chatId": -1001234567890,  // Optional, defaults to env var
 *   "syncLocations": false      // Optional, also sync locations from tickets
 * }
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse and validate request body
    const body = await req.json().catch(() => ({}));
    const validation = SyncRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body",
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { chatId, syncLocations } = validation.data;

    // Get chatId from request or environment variable
    const targetChatId = chatId || process.env.TELEGRAM_SYNC_CHAT_ID;

    if (!targetChatId) {
      return NextResponse.json(
        {
          success: false,
          error: "Chat ID not provided. Please provide chatId in request body or set TELEGRAM_SYNC_CHAT_ID environment variable.",
        },
        { status: 400 }
      );
    }

    console.log(`[API] Starting user sync for chat ${targetChatId}`);

    // Sync users
    const userMetrics = await syncTelegramUsers(Number(targetChatId));

    // Optionally sync locations from tickets
    let locationMetrics = null;
    if (syncLocations) {
      console.log(`[API] Syncing locations from tickets`);
      locationMetrics = await syncLocationsFromTickets();
    }

    const duration = Date.now() - startTime;

    const response = {
      success: true,
      metrics: {
        users: userMetrics.users,
        locations: locationMetrics || userMetrics.locations,
      },
      duration,
      timestamp: new Date().toISOString(),
      errorDetails: userMetrics.errorDetails && userMetrics.errorDetails.length > 0
        ? userMetrics.errorDetails
        : undefined,
    };

    console.log(`[API] Sync completed successfully in ${duration}ms`);

    return NextResponse.json(response);
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error("[API] Sync failed:", err);

    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        duration,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync/users
 * 
 * Get sync status/info (optional - for future use)
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/sync/users",
    method: "POST",
    description: "Manually trigger Telegram user sync",
    requiredEnv: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_SYNC_CHAT_ID (optional)"],
    requestBody: {
      chatId: "number (optional)",
      syncLocations: "boolean (optional, default: false)",
    },
  });
}
