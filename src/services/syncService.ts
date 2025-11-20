// services/syncService.ts
import { User, IUser } from "@/models/User";
import { Location, ILocation } from "@/models/Location";
import { telegramGetChatAdministrators } from "@/lib/telegram";
import { connectToDB } from "@/lib/mongodb";

/**
 * Sync metrics returned from sync operations
 */
export interface SyncMetrics {
  users: {
    created: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  locations: {
    created: number;
    updated: number;
    skipped: number;
  };
  duration: number;
  timestamp: string;
  errorDetails?: Array<{ user: string; error: string }>;
}

/**
 * Telegram user data from API
 */
interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

/**
 * Telegram ChatMember object from getChatAdministrators
 */
interface TelegramChatMember {
  user: TelegramUser;
  status: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked";
}

/**
 * Main sync function - fetches Telegram group administrators and syncs to database
 */
export async function syncTelegramUsers(
  chatId: number | string
): Promise<SyncMetrics> {
  const startTime = Date.now();
  const metrics: SyncMetrics = {
    users: { created: 0, updated: 0, skipped: 0, errors: 0 },
    locations: { created: 0, updated: 0, skipped: 0 },
    duration: 0,
    timestamp: new Date().toISOString(),
    errorDetails: [],
  };

  try {
    await connectToDB();

    // Fetch administrators from Telegram
    console.log(`[SyncService] Fetching administrators for chat ${chatId}`);
    const adminResponse = await telegramGetChatAdministrators(chatId);

    if (!adminResponse.ok || !adminResponse.result) {
      throw new Error(
        `Failed to fetch administrators: ${adminResponse.description || "Unknown error"}`
      );
    }

    const administrators = adminResponse.result as TelegramChatMember[];
    console.log(`[SyncService] Found ${administrators.length} administrators`);

    // Process each administrator
    for (const admin of administrators) {
      try {
        const { user, status } = admin;

        // Skip bots
        if (user.is_bot) {
          metrics.users.skipped++;
          continue;
        }

        // Upsert user and get location operation
        const result = await upsertUser(user, "admin_sync", Number(chatId), status);

        if (result.userAction === "created") {
          metrics.users.created++;
        } else if (result.userAction === "updated") {
          metrics.users.updated++;
        } else {
          metrics.users.skipped++;
        }

        // collect location metrics if any
        if (result.locationOp === "created") {
          metrics.locations.created++;
        } else if (result.locationOp === "updated") {
          metrics.locations.updated++;
        } else if (result.locationOp === "skipped") {
          metrics.locations.skipped++;
        }

      } catch (err) {
        metrics.users.errors++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        metrics.errorDetails?.push({
          user: admin.user.username || admin.user.first_name || String(admin.user.id),
          error: errorMsg,
        });
        console.error(`[SyncService] Error processing user ${admin.user.id}:`, err);
      }
    }

    // Calculate duration
    metrics.duration = Date.now() - startTime;

    console.log(`[SyncService] Sync completed:`, {
      users: metrics.users,
      locations: metrics.locations,
      duration: `${metrics.duration}ms`,
    });

    return metrics;
  } catch (err) {
    console.error("[SyncService] Sync failed:", err);
    metrics.duration = Date.now() - startTime;
    throw err;
  }
}

// add a small type for the expanded upsert result
type UpsertUserResult = {
  userAction: "created" | "updated" | "skipped";
  userDoc: IUser;
  locationOp?: "created" | "updated" | "skipped" | null;
  location?: ILocation | null;
};

/**
 * Find a recent ticket for the user and attach a derived/created location to the user (if possible)
 */
async function attachLocationToUser(userDoc: IUser): Promise<{ operation: "created" | "updated" | "skipped" | null; location?: ILocation | null }> {
  try {
    // dynamically import Ticket to avoid circular import problems
    const { Ticket } = await import("@/models/Ticket");

    // try multiple possible createdBy matches: username, full name, firstName, lastName
    const candidates: string[] = [];

    if (userDoc.username) candidates.push(userDoc.username);
    const fullName = `${userDoc.firstName || ""} ${userDoc.lastName || ""}`.trim();
    if (fullName) candidates.push(fullName);
    if (userDoc.firstName) candidates.push(userDoc.firstName);
    if (userDoc.lastName) candidates.push(userDoc.lastName);

    // Query latest ticket where createdBy matches any candidate
    const ticket = await Ticket.findOne({
      createdBy: { $in: candidates.length ? candidates : ["__no_match__"] },
    }).sort({ createdAt: -1 }).lean();

    if (!ticket || !ticket.description) {
      return { operation: null, location: null };
    }

    // derive / upsert location from ticket description using your helper
    const { location, operation } = await deriveAndUpsertLocation(ticket.description);

    if (!location) return { operation: null, location: null };

    // attach if different
    if (!userDoc.locationId || String(userDoc.locationId) !== String(location._id)) {
      userDoc.locationId = location._id;
      await userDoc.save();
      return { operation: operation === "created" ? "created" : "updated", location };
    }

    // already attached and matches
    return { operation: "skipped", location };
  } catch (err) {
    console.error("[SyncService] attachLocationToUser error:", err);
    return { operation: null, location: null };
  }
}

/**
 * Upsert a user into the database (idempotent) — now returns location operation as well.
 */
export async function upsertUser(
  telegramUser: TelegramUser,
  source: "webhook" | "admin_sync" | "manual",
  chatId: number,
  role?: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked"
): Promise<UpsertUserResult> {
  // ensure DB connected upstream (syncTelegramUsers does connectToDB)
  const now = new Date();
  let existingUser = await User.findOne({ telegramId: telegramUser.id });

  if (existingUser) {
    let hasChanges = false;

    if (telegramUser.username && existingUser.username !== telegramUser.username) {
      existingUser.username = telegramUser.username;
      hasChanges = true;
    }

    if (telegramUser.first_name && existingUser.firstName !== telegramUser.first_name) {
      existingUser.firstName = telegramUser.first_name;
      hasChanges = true;
    }

    if (telegramUser.last_name && existingUser.lastName !== telegramUser.last_name) {
      existingUser.lastName = telegramUser.last_name;
      hasChanges = true;
    }

    if (telegramUser.language_code && existingUser.languageCode !== telegramUser.language_code) {
      existingUser.languageCode = telegramUser.language_code;
      hasChanges = true;
    }

    if (telegramUser.is_premium !== undefined && existingUser.isPremium !== telegramUser.is_premium) {
      existingUser.isPremium = telegramUser.is_premium;
      hasChanges = true;
    }

    if (role && existingUser.role !== role) {
      existingUser.role = role;
      hasChanges = true;
    }

    // Update tracking fields
    existingUser.lastSeenAt = now;
    existingUser.lastSyncedAt = now;

    // Add chatId if not already present
    if (!existingUser.chatIds.includes(chatId)) {
      existingUser.chatIds.push(chatId);
      hasChanges = true;
    }

    if (hasChanges) {
      await existingUser.save();
      // after save, attempt to attach location
      const { operation: locationOp, location } = await attachLocationToUser(existingUser);
      return { userAction: "updated", userDoc: existingUser, locationOp: locationOp ?? null, location: location ?? null };
    }

    // no content changes, but update timestamps and still attempt attach
    await existingUser.save();
    const { operation: locationOp2, location: location2 } = await attachLocationToUser(existingUser);
    return { userAction: "skipped", userDoc: existingUser, locationOp: locationOp2 ?? null, location: location2 ?? null };
  } else {
    // create new user
    const created = await User.create({
      telegramId: telegramUser.id,
      username: telegramUser.username || null,
      firstName: telegramUser.first_name || null,
      lastName: telegramUser.last_name || null,
      isBot: telegramUser.is_bot,
      languageCode: telegramUser.language_code || null,
      isPremium: telegramUser.is_premium || false,
      role: role || "member",
      firstSeenAt: now,
      lastSeenAt: now,
      lastSyncedAt: now,
      source,
      chatIds: [chatId],
    });

    // try to attach location (if there's a matching ticket)
    const { operation: locationOp, location } = await attachLocationToUser(created);
    return { userAction: "created", userDoc: created, locationOp: locationOp ?? null, location: location ?? null };
  }
}

/**
 * Extract location from text after "at" or "in" keyword, or direct room pattern
 * Examples:
 *   "table broken at room number 43" -> "room number 43"
 *   "light not working in room 45" -> "room 45"
 *   "AC issue at Building A" -> "Building A"
 *   "leak in area 5" -> "area 5"
 *   "broken chair room 12" -> "room 12"
 */
export function extractLocationFromText(text: string): string | null {
  if (!text) return null;

  const lower = text.toLowerCase();

  // Pattern 1: "at <location>" or "in <location>"
  const atInMatch = text.match(/\b(?:at|in)\s+(.+?)(?:\.|$|,|\n|;)/i);
  if (atInMatch && atInMatch[1]) {
    return atInMatch[1].trim();
  }

  // Pattern 2: Direct room number pattern "room <number>" or "room number <number>"
  const roomMatch = text.match(/\broom\s*(?:number|no\.?|#)?\s*(\d+)\b/i);
  if (roomMatch) {
    return `room ${roomMatch[1]}`;
  }

  // Pattern 3: Building pattern "building <letter/number>"
  const buildingMatch = text.match(/\bbuilding\s+([a-z0-9]+)\b/i);
  if (buildingMatch) {
    return `building ${buildingMatch[1]}`;
  }

  // Pattern 4: Floor pattern "<number>st/nd/rd/th floor" or "floor <number>"
  const floorMatch = text.match(/\b(?:(\d+)(?:st|nd|rd|th)\s+floor|floor\s+(\d+))\b/i);
  if (floorMatch) {
    const floorNum = floorMatch[1] || floorMatch[2];
    return `floor ${floorNum}`;
  }

  // Pattern 5: Area/Zone pattern "area <number/letter>" or "zone <number/letter>"
  const areaMatch = text.match(/\b(?:area|zone)\s+([a-z0-9]+)\b/i);
  if (areaMatch) {
    return `${areaMatch[0]}`;
  }

  return null;
}


/**
 * Derive location type from location name
 */
function deriveLocationType(
  locationName: string
): "room" | "building" | "floor" | "area" | "other" {
  const lower = locationName.toLowerCase();

  if (lower.includes("room") || lower.match(/\br\s*\d+/i)) {
    return "room";
  }
  if (lower.includes("building") || lower.includes("bldg")) {
    return "building";
  }
  if (lower.includes("floor") || lower.match(/\d+(st|nd|rd|th)\s*floor/i)) {
    return "floor";
  }
  if (lower.includes("area") || lower.includes("zone")) {
    return "area";
  }

  return "other";
}

/**
 * Generate a code from location name
 * Examples:
 *   "room number 43" -> "R43"
 *   "room 45" -> "R45"
 *   "Building A" -> "BLDG-A"
 *   "floor 3" -> "F3"
 */
function generateLocationCode(locationName: string): string | null {
  const lower = locationName.toLowerCase();

  // Extract room number (handles "room 45", "room number 43", "room no. 12", etc.)
  const roomMatch = lower.match(/room\s*(?:number|no\.?|#)?\s*(\d+)/i);
  if (roomMatch) {
    return `R${roomMatch[1]}`;
  }

  // Extract building letter/number
  const buildingMatch = lower.match(/building\s*([a-z0-9]+)/i);
  if (buildingMatch) {
    return `BLDG-${buildingMatch[1].toUpperCase()}`;
  }

  // Extract floor number
  const floorMatch = lower.match(/floor\s*(\d+)/i);
  if (floorMatch) {
    return `F${floorMatch[1]}`;
  }

  // Extract area/zone
  const areaMatch = lower.match(/(?:area|zone)\s*([a-z0-9]+)/i);
  if (areaMatch) {
    return `AREA-${areaMatch[1].toUpperCase()}`;
  }

  return null;
}

/**
 * Derive and upsert location from description text
 */
export async function deriveAndUpsertLocation(
  description: string
): Promise<{ location: ILocation | null; operation: "created" | "updated" | "skipped" }> {
  const locationName = extractLocationFromText(description);

  if (!locationName) {
    return { location: null, operation: "skipped" };
  }

  const locationType = deriveLocationType(locationName);
  const locationCode = generateLocationCode(locationName);

  // Check if location already exists by name or code
  let existingLocation = null;

  if (locationCode) {
    existingLocation = await Location.findOne({ code: locationCode });
  }

  if (!existingLocation) {
    existingLocation = await Location.findOne({ 
      name: { $regex: new RegExp(`^${locationName}$`, 'i') } 
    });
  }

  if (existingLocation) {
    // Location exists, check if update needed
    let hasChanges = false;

    if (existingLocation.type !== locationType) {
      existingLocation.type = locationType;
      hasChanges = true;
    }

    if (locationCode && existingLocation.code !== locationCode) {
      existingLocation.code = locationCode;
      hasChanges = true;
    }

    if (hasChanges) {
      await existingLocation.save();
      return { location: existingLocation, operation: "updated" };
    }

    return { location: existingLocation, operation: "skipped" };
  } else {
    // Create new location
    const newLocation = await Location.create({
      name: locationName,
      type: locationType,
      code: locationCode,
      isActive: true,
    });

    return { location: newLocation, operation: "created" };
  }
}

/**
 * Sync locations from existing tickets
 * This can be called to backfill locations from historical ticket data
 */
export async function syncLocationsFromTickets(): Promise<{
  created: number;
  updated: number;
  skipped: number;
}> {
  await connectToDB();
  
  const { Ticket } = await import("@/models/Ticket");
  
  const metrics = {
    created: 0,
    updated: 0,
    skipped: 0,
  };

  try {
    const tickets = await Ticket.find({});
    
    for (const ticket of tickets) {
      try {
        const result = await deriveAndUpsertLocation(ticket.description);
        
        if (result.operation === "created") {
          metrics.created++;
        } else if (result.operation === "updated") {
          metrics.updated++;
        } else {
          metrics.skipped++;
        }
      } catch (err) {
        console.error(`[SyncService] Error processing ticket ${ticket.ticketId}:`, err);
      }
    }

    console.log(`[SyncService] Location sync from tickets completed:`, metrics);
    return metrics;
  } catch (err) {
    console.error("[SyncService] Failed to sync locations from tickets:", err);
    throw err;
  }
}
