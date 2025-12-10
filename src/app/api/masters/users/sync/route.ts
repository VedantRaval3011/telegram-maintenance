// app/api/masters/users/sync/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { User } from "@/models/User";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_SYNC_CHAT_ID = process.env.TELEGRAM_SYNC_CHAT_ID;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

interface TelegramChatMember {
  user: {
    id: number;
    is_bot: boolean;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
  };
  status: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked";
}

/**
 * POST /api/masters/users/sync
 * Sync users from a Telegram group chat
 * Uses TELEGRAM_SYNC_CHAT_ID from env, or accepts optional chatId in body
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDB();

    const body = await req.json().catch(() => ({}));
    // Use chatId from request body, or fall back to environment variable
    const chatId = body.chatId || TELEGRAM_SYNC_CHAT_ID;

    if (!chatId) {
      return NextResponse.json(
        { success: false, error: "Chat ID is required. Set TELEGRAM_SYNC_CHAT_ID in environment or provide chatId in request." },
        { status: 400 }
      );
    }

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Telegram bot token not configured" },
        { status: 500 }
      );
    }

    // Get chat administrators first
    const adminResponse = await fetch(`${TELEGRAM_API}/getChatAdministrators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId }),
    });

    const adminData = await adminResponse.json();
    
    if (!adminData.ok) {
      return NextResponse.json(
        { 
          success: false, 
          error: adminData.description || "Failed to get chat administrators",
          telegram_error: adminData 
        },
        { status: 400 }
      );
    }

    const administrators: TelegramChatMember[] = adminData.result || [];
    
    // Note: Telegram Bot API doesn't have getChatMembers for regular members
    // We can only get administrators. For full member list, bot needs admin rights
    // and we need to track members from webhook messages
    
    let created = 0;
    let updated = 0;
    const syncedAt = new Date();

    for (const member of administrators) {
      const telegramUser = member.user;
      
      // Skip bots
      if (telegramUser.is_bot) continue;

      const existingUser = await User.findOne({ telegramId: telegramUser.id });

      if (existingUser) {
        // Update existing user
        await User.updateOne(
          { telegramId: telegramUser.id },
          {
            $set: {
              username: telegramUser.username || existingUser.username,
              firstName: telegramUser.first_name || existingUser.firstName,
              lastName: telegramUser.last_name || existingUser.lastName,
              languageCode: telegramUser.language_code || existingUser.languageCode,
              isPremium: telegramUser.is_premium || existingUser.isPremium,
              role: member.status,
              lastSyncedAt: syncedAt,
            },
            $addToSet: { chatIds: chatId },
          }
        );
        updated++;
      } else {
        // Create new user
        await User.create({
          telegramId: telegramUser.id,
          username: telegramUser.username,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          isBot: false,
          languageCode: telegramUser.language_code,
          isPremium: telegramUser.is_premium || false,
          role: member.status,
          source: "admin_sync",
          chatIds: [chatId],
          firstSeenAt: syncedAt,
          lastSeenAt: syncedAt,
          lastSyncedAt: syncedAt,
        });
        created++;
      }
    }

    // Try to get chat info for display
    let chatTitle = `Chat ${chatId}`;
    try {
      const chatInfoResponse = await fetch(`${TELEGRAM_API}/getChat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId }),
      });
      const chatInfo = await chatInfoResponse.json();
      if (chatInfo.ok && chatInfo.result?.title) {
        chatTitle = chatInfo.result.title;
      }
    } catch {
      // Ignore error, use default title
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${created + updated} users from "${chatTitle}"`,
      data: {
        chatId,
        chatTitle,
        created,
        updated,
        total: administrators.length,
        syncedAt,
      },
    });
  } catch (error: any) {
    console.error("[API] Failed to sync users from Telegram:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to sync users" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/masters/users/sync
 * Get sync status / info
 */
export async function GET() {
  try {
    await connectToDB();

    // Get last synced user info
    const lastSynced = await User.findOne({ source: "admin_sync" })
      .sort({ lastSyncedAt: -1 })
      .select("lastSyncedAt chatIds")
      .lean();

    const syncedUsersCount = await User.countDocuments({ source: "admin_sync" });

    return NextResponse.json({
      success: true,
      data: {
        lastSyncedAt: lastSynced?.lastSyncedAt || null,
        syncedUsersCount,
        chatIds: lastSynced?.chatIds || [],
      },
    });
  } catch (error: any) {
    console.error("[API] Failed to get sync status:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
