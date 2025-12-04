/**
 * Fast Image Upload Module
 * 
 * Optimized for speed with:
 * - Parallel download and upload preparation
 * - Direct buffer streaming (no temp files)
 * - Efficient FormData handling
 * - Request timeout for reliability
 * 
 * Updated to use BunnyCDN instead of Cloudinary
 */

import { uploadToBunny } from "./bunnyStorage";

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

/**
 * Fast download of Telegram file to buffer
 * Uses AbortController for timeout
 */
export async function fastDownloadTelegramFile(fileId: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    // Get file path from Telegram
    const fileInfoRes = await fetch(
      `${TELEGRAM_API}/getFile?file_id=${fileId}`,
      { signal: controller.signal }
    );
    const fileInfo = await fileInfoRes.json();
    
    if (!fileInfo.ok) {
      throw new Error(`Failed to get file path: ${fileInfo.description}`);
    }

    const filePath = fileInfo.result.file_path;

    // Download file directly to buffer
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
    const fileRes = await fetch(fileUrl, { signal: controller.signal });
    
    if (!fileRes.ok) {
      throw new Error(`Failed to download file: ${fileRes.status}`);
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fast upload to BunnyCDN with optimizations
 * (Replaces fastUploadToCloudinary)
 */
export async function fastUploadToBunny(
  buffer: Buffer,
  folder: string = "telegram-maintenance"
): Promise<string> {
  return uploadToBunny(buffer, folder);
}

/**
 * @deprecated Use fastUploadToBunny instead
 * Kept for backward compatibility during migration
 */
export async function fastUploadToCloudinary(
  buffer: Buffer,
  folder: string = "telegram-maintenance"
): Promise<string> {
  console.warn("[DEPRECATED] fastUploadToCloudinary is deprecated. Use fastUploadToBunny instead.");
  return uploadToBunny(buffer, folder);
}

/**
 * Combined fast download + upload in single call
 * Returns URL or null if failed (non-blocking for main flow)
 */
export async function fastProcessTelegramPhoto(fileId: string): Promise<string | null> {
  try {
    const buffer = await fastDownloadTelegramFile(fileId);
    const url = await uploadToBunny(buffer);
    return url;
  } catch (err) {
    console.error("[FAST PHOTO] Processing failed:", err);
    return null;
  }
}
