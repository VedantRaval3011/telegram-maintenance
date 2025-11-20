// lib/wizardHelpers.ts
import { WizardSession, IWizardSession } from "@/models/WizardSession";
import { Ticket } from "@/models/Ticket";
import { editMessageText, generateTicketId } from "./telegram";

/**
 * Create a new wizard session
 */
export async function createWizardSession(
  chatId: number,
  userId: number,
  botMessageId: number,
  originalText: string
): Promise<IWizardSession> {
  const session = await WizardSession.create({
    chatId,
    userId,
    botMessageId,
    originalText,
    category: null,
    priority: null,
    location: {
      building: null,
      floor: null,
      room: null,
    },
    currentStep: "category",
  });

  return session;
}

/**
 * Get wizard session by bot message ID
 */
export async function getWizardSession(botMessageId: number): Promise<IWizardSession | null> {
  return await WizardSession.findOne({ botMessageId });
}

/**
 * Update wizard session
 */
export async function updateWizardSession(
  botMessageId: number,
  updates: Partial<IWizardSession>
): Promise<IWizardSession | null> {
  return await WizardSession.findOneAndUpdate(
    { botMessageId },
    { $set: updates },
    { new: true }
  );
}

/**
 * Delete wizard session
 */
export async function deleteWizardSession(botMessageId: number): Promise<void> {
  await WizardSession.deleteOne({ botMessageId });
}

/**
 * Check if wizard is complete
 */
export function isWizardComplete(session: IWizardSession): boolean {
  return !!(
    session.category &&
    session.priority &&
    session.location.building &&
    session.location.floor &&
    session.location.room
  );
}

/**
 * Format wizard message text
 */
export function formatWizardMessage(session: IWizardSession): string {
  const categoryEmoji: Record<string, string> = {
    electrical: "⚡",
    plumbing: "🚰",
    furniture: "🪑",
    cleaning: "🧹",
    hvac: "❄️",
    paint: "🎨",
    other: "📋",
  };

  const priorityEmoji: Record<string, string> = {
    high: "🔴",
    medium: "🟡",
    low: "🟢",
  };

  const categoryText = session.category
    ? `${categoryEmoji[session.category] || "📋"} ${session.category.charAt(0).toUpperCase() + session.category.slice(1)}`
    : "—";

  const priorityText = session.priority
    ? `${priorityEmoji[session.priority]} ${session.priority.charAt(0).toUpperCase() + session.priority.slice(1)}`
    : "—";

  let locationText = "—";
  if (session.location.building && session.location.floor && session.location.room) {
    locationText = `${session.location.building} - Floor ${session.location.floor} - Room ${session.location.room}`;
  } else if (session.location.building && session.location.floor) {
    locationText = `${session.location.building} - Floor ${session.location.floor}`;
  } else if (session.location.building) {
    locationText = session.location.building;
  }

  return `🛠 <b>Ticket Wizard</b>\n📝 Issue: ${session.originalText}\n\n<b>Category:</b> ${categoryText}\n<b>Priority:</b> ${priorityText}\n<b>Location:</b> ${locationText}\n\n${
    isWizardComplete(session) ? "✅ All information complete!" : "⚠️ Please complete the selections below:"
  }`;
}

/**
 * Build category selection keyboard
 */
export function buildCategoryKeyboard(botMessageId: number): any[] {
  return [
    [
      { text: "⚡ Electrical", callback_data: `cat_${botMessageId}_electrical` },
      { text: "🚰 Plumbing", callback_data: `cat_${botMessageId}_plumbing` },
    ],
    [
      { text: "🪑 Furniture", callback_data: `cat_${botMessageId}_furniture` },
      { text: "🧹 Cleaning", callback_data: `cat_${botMessageId}_cleaning` },
    ],
    [
      { text: "❄️ HVAC", callback_data: `cat_${botMessageId}_hvac` },
      { text: "🎨 Paint", callback_data: `cat_${botMessageId}_paint` },
    ],
    [{ text: "📋 Other", callback_data: `cat_${botMessageId}_other` }],
  ];
}

/**
 * Build priority selection keyboard
 */
export function buildPriorityKeyboard(botMessageId: number): any[] {
  return [
    [
      { text: "🔴 High", callback_data: `pri_${botMessageId}_high` },
      { text: "🟡 Medium", callback_data: `pri_${botMessageId}_medium` },
      { text: "🟢 Low", callback_data: `pri_${botMessageId}_low` },
    ],
  ];
}

/**
 * Build location building selection keyboard
 */
export function buildLocationBuildingKeyboard(botMessageId: number): any[] {
  return [
    [
      { text: "🏢 Building A", callback_data: `loc_bld_${botMessageId}_A` },
      { text: "🏢 Building B", callback_data: `loc_bld_${botMessageId}_B` },
    ],
    [
      { text: "🏢 Building C", callback_data: `loc_bld_${botMessageId}_C` },
    ],
  ];
}

/**
 * Build location floor selection keyboard
 */
export function buildLocationFloorKeyboard(botMessageId: number): any[] {
  return [
    [
      { text: "1️⃣ Floor 1", callback_data: `loc_flr_${botMessageId}_1` },
      { text: "2️⃣ Floor 2", callback_data: `loc_flr_${botMessageId}_2` },
      { text: "3️⃣ Floor 3", callback_data: `loc_flr_${botMessageId}_3` },
    ],
    [{ text: "⬅️ Back", callback_data: `back_${botMessageId}_building` }],
  ];
}

/**
 * Build location room selection keyboard
 */
export function buildLocationRoomKeyboard(botMessageId: number, floor: string): any[] {
  const floorNum = parseInt(floor);
  const rooms = [];

  // Generate room numbers based on floor
  for (let i = 1; i <= 3; i++) {
    const roomNum = `${floorNum}0${i}`;
    rooms.push({
      text: `🚪 Room ${roomNum}`,
      callback_data: `loc_room_${botMessageId}_${roomNum}`,
    });
  }

  return [rooms, [{ text: "⬅️ Back", callback_data: `back_${botMessageId}_floor` }]];
}

/**
 * Build main wizard keyboard based on current state
 */
export function buildWizardKeyboard(session: IWizardSession): any[] {
  const keyboard: any[] = [];

  if (!session.category) {
    keyboard.push([{ text: "📂 Select Category", callback_data: `step_${session.botMessageId}_category` }]);
  }

  if (!session.priority) {
    keyboard.push([{ text: "⚡ Select Priority", callback_data: `step_${session.botMessageId}_priority` }]);
  }

  if (!session.location.building || !session.location.floor || !session.location.room) {
    keyboard.push([{ text: "📍 Select Location", callback_data: `step_${session.botMessageId}_location` }]);
  }

  if (isWizardComplete(session)) {
    keyboard.push([{ text: "✅ Create Ticket", callback_data: `submit_${session.botMessageId}` }]);
  }

  return keyboard;
}

/**
 * Create ticket from completed wizard
 */
export async function createTicketFromWizard(
  session: IWizardSession,
  createdBy: string
): Promise<any> {
  const ticketId = await generateTicketId();

  const locationString = `${session.location.building} - Floor ${session.location.floor} - Room ${session.location.room}`;

  const ticket = await Ticket.create({
    ticketId,
    description: session.originalText,
    category: session.category,
    priority: session.priority,
    location: locationString,
    photos: [],
    createdBy,
    createdAt: new Date(),
    status: "PENDING",
    telegramMessageId: session.botMessageId,
    telegramChatId: session.chatId,
  });

  return ticket;
}

/**
 * Update wizard UI
 */
export async function updateWizardUI(session: IWizardSession): Promise<void> {
  const message = formatWizardMessage(session);
  const keyboard = buildWizardKeyboard(session);

  await editMessageText(session.chatId, session.botMessageId, message, keyboard);
}
