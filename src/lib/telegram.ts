// lib/telegram.ts
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import FormData from "form-data";
import { Ticket } from "../models/Ticket"; // adjust path as needed

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not defined");

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const TELEGRAM_FILE_API = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}`;

/** Telegram response types */
type TelegramApiResponse<T = any> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

type TelegramGetFileSuccess = {
  file_id: string;
  file_unique_id?: string;
  file_path: string;
};

type TelegramGetFileError = {
  ok: false;
  error_code?: number;
  description?: string;
};

type TelegramGetFileResponse =
  | {
      ok: true;
      result: TelegramGetFileSuccess;
    }
  | TelegramGetFileError;

/** Send a text message */
export async function telegramSendMessage(
  chatId: number | string,
  text: string,
  replyToMessageId?: number,
  inlineKeyboard?: any
): Promise<TelegramApiResponse> {
  const url = `${TELEGRAM_API}/sendMessage`;
  const body: any = { chat_id: chatId, text, parse_mode: "HTML" };
  if (replyToMessageId) body.reply_to_message_id = replyToMessageId;
  if (inlineKeyboard) body.reply_markup = { inline_keyboard: inlineKeyboard };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as TelegramApiResponse;
  if (!json.ok) console.error("telegramSendMessage error:", json);
  return json;
}

/** Send a photo (URL or local path) */
export async function telegramSendPhoto(
  chatId: number | string,
  photoPathOrUrl: string,
  caption?: string
): Promise<TelegramApiResponse> {
  const isUrl = /^https?:\/\//i.test(photoPathOrUrl);

  if (isUrl) {
    const res = await fetch(`${TELEGRAM_API}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, photo: photoPathOrUrl, caption }),
    });
    const json = (await res.json()) as TelegramApiResponse;
    if (!json.ok) console.error("telegramSendPhoto (url) error:", json);
    return json;
  }

  if (!fs.existsSync(photoPathOrUrl)) {
    throw new Error(
      `telegramSendPhoto: file does not exist at path: ${photoPathOrUrl}`
    );
  }

  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("photo", fs.createReadStream(photoPathOrUrl));
  if (caption) form.append("caption", caption);

  const res = await fetch(`${TELEGRAM_API}/sendPhoto`, {
    method: "POST",
    body: form as any, // form-data handles headers
  });

  const json = (await res.json()) as TelegramApiResponse;
  if (!json.ok) console.error("telegramSendPhoto (upload) error:", json);
  return json;
}

/**
 * Download file using getFile -> then file API.
 * Properly narrows the response before accessing result.
 */
export async function downloadTelegramFile(
  fileId: string,
  destFolder = "public/uploads"
): Promise<string> {
  const getFileUrl = `${TELEGRAM_API}/getFile?file_id=${encodeURIComponent(
    fileId
  )}`;
  const r1 = await fetch(getFileUrl);

  if (!r1.ok) {
    const bodyText = await r1.text().catch(() => "");
    throw new Error(
      `downloadTelegramFile: getFile HTTP error ${r1.status}. Body: ${bodyText}`
    );
  }

  // parse and narrow based on the `ok` discriminant
  const j1 = (await r1.json()) as TelegramGetFileResponse;

  // Narrow: if j1.ok is false, it's the error variant; if true, it's the success variant with result.
  if (!j1.ok) {
    // j1 is TelegramGetFileError here
    const err = j1 as TelegramGetFileError;
    throw new Error(
      `downloadTelegramFile: Telegram getFile error: ${
        err.description || JSON.stringify(err)
      }`
    );
  }

  // At this point TypeScript knows j1 is the success variant
  const filePath = j1.result.file_path; // safe access

  // ensure destination folder exists
  if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });

  // download from file API
  const fileUrl = `${TELEGRAM_FILE_API}/${filePath}`;
  const res = await fetch(fileUrl);
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(
      `downloadTelegramFile: failed to download file. Status ${res.status}. Body: ${t}`
    );
  }

  const ext = path.extname(filePath) || ".jpg";
  const fileName = `${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}${ext}`;
  const savePath = path.join(destFolder, fileName);
  const writeStream = fs.createWriteStream(savePath);

  await new Promise<void>((resolve, reject) => {
    res.body!.pipe(writeStream);
    res.body!.on("error", (err: any) => reject(err));
    writeStream.on("finish", () => resolve());
    writeStream.on("error", (err: any) => reject(err));
  });

  // return public path (Next.js serves /public at root)
  return `/uploads/${fileName}`;
}

/** Get chat administrators */
export async function telegramGetChatAdministrators(
  chatId: number | string
): Promise<TelegramApiResponse> {
  const url = `${TELEGRAM_API}/getChatAdministrators`;
  const body = { chat_id: chatId };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as TelegramApiResponse;
  if (!json.ok) console.error("telegramGetChatAdministrators error:", json);
  return json;
}

/** Simple ticket id generator - not concurrency safe */
export async function generateTicketId(): Promise<string> {
  try {
    const count = await Ticket.countDocuments();
    const id = count + 1;
    return `TCK-${String(id).padStart(3, "0")}`;
  } catch (err) {
    console.error("generateTicketId error:", err);
    const fallback = Math.floor(Math.random() * 100000);
    return `TCK-${String(fallback).padStart(3, "0")}`;
  }
}

/** Edit an existing message */
export async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  inlineKeyboard?: any
): Promise<TelegramApiResponse> {
  const url = `${TELEGRAM_API}/editMessageText`;
  const body: any = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
  };
  if (inlineKeyboard) body.reply_markup = { inline_keyboard: inlineKeyboard };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as TelegramApiResponse;
  if (!json.ok) console.error("editMessageText error:", json);
  return json;
}

/** Answer a callback query (button click) */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert = false
): Promise<TelegramApiResponse> {
  const url = `${TELEGRAM_API}/answerCallbackQuery`;
  const body: any = { callback_query_id: callbackQueryId };
  if (text) body.text = text;
  if (showAlert) body.show_alert = true;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as TelegramApiResponse;
  if (!json.ok) console.error("answerCallbackQuery error:", json);
  return json;
}
