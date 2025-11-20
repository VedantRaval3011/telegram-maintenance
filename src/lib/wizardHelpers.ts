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
  originalText: string,
  initialCategory: string | null = null,
  initialPhotos: string[] = []
): Promise<IWizardSession> {
  const session = await WizardSession.create({
    chatId,
    userId,
    botMessageId,
    originalText,
    category: initialCategory,
    priority: null,
    location: {
      building: null,
      floor: null,
      room: null,
    },
    currentStep: initialCategory ? "priority" : "category",
    waitingForInput: false,
    inputField: null,
    customLocation: null,
    photos: initialPhotos,
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
    ((session.location.building && session.location.floor && session.location.room) || session.customLocation)
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
  if (session.customLocation) {
    locationText = session.customLocation;
  } else if (session.location.building && session.location.floor && session.location.room) {
    locationText = `${session.location.building} - Floor ${session.location.floor} - Room ${session.location.room}`;
  } else if (session.location.building && session.location.floor) {
    locationText = `${session.location.building} - Floor ${session.location.floor}`;
  } else if (session.location.building) {
    locationText = session.location.building;
  }

  const photosText = session.photos && session.photos.length > 0
    ? `📸 <b>Photos:</b> ${session.photos.length} attached`
    : "📸 <b>Photos:</b> None (Send an image to attach)";

  if (session.waitingForInput) {
    const inputPrompt = session.inputField === "category" 
      ? "✍️ Please type the <b>Category</b> name below:" 
      : "✍️ Please type the <b>Location</b> details below:";
    
    return `🛠 <b>Ticket Wizard</b>\n\n${inputPrompt}`;
  }

  return `🛠 <b>Ticket Wizard</b>\n📝 Issue: ${session.originalText}\n\n<b>Category:</b> ${categoryText}\n<b>Priority:</b> ${priorityText}\n<b>Location:</b> ${locationText}\n${photosText}\n\n${
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
    [{ text: "📋 Other (Manual Entry)", callback_data: `cat_${botMessageId}_manual` }],
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
    [
      { text: "✍️ Manual Entry", callback_data: `loc_manual_${botMessageId}` },
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

  // Category button (always show)
  const categoryText = session.category ? "📂 Change Category" : "📂 Select Category";
  keyboard.push([{ text: categoryText, callback_data: `step_${session.botMessageId}_category` }]);

  // Priority button (always show)
  const priorityText = session.priority ? "⚡ Change Priority" : "⚡ Select Priority";
  keyboard.push([{ text: priorityText, callback_data: `step_${session.botMessageId}_priority` }]);

  // Location button (always show)
  const hasLocation = (session.location.building && session.location.floor && session.location.room) || session.customLocation;
  const locationText = hasLocation ? "📍 Change Location" : "📍 Select Location";
  keyboard.push([{ text: locationText, callback_data: `step_${session.botMessageId}_location` }]);

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

  const locationString = session.customLocation 
    ? session.customLocation 
    : `${session.location.building} - Floor ${session.location.floor} - Room ${session.location.room}`;

  console.log("[CREATE_TICKET] About to create ticket with photos:", session.photos);

  const ticket = await Ticket.create({
    ticketId,
    description: session.originalText,
    category: session.category,
    priority: session.priority,
    location: locationString,
    photos: session.photos || [],
    createdBy,
    createdAt: new Date(),
    status: "PENDING",
    telegramMessageId: session.botMessageId,
    telegramChatId: session.chatId,
  });

  console.log("[CREATE_TICKET] Ticket created, checking photos field:");
  console.log("[CREATE_TICKET] ticket.photos:", ticket.photos);
  console.log("[CREATE_TICKET] ticket object:", JSON.stringify(ticket, null, 2));

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
