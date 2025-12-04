/**
 * Fast Image Upload Module
 * 
 * Optimized for speed with:
 * - Parallel download and upload preparation
 * - Direct buffer streaming (no temp files)
 * - Efficient FormData handling
 * - Request timeout for reliability
 */

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const UPLOAD_TIMEOUT = 15000; // 15 seconds max for upload

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
 * Fast upload to Cloudinary with optimizations
 * - Smaller image size (width limit)
 * - Quality optimization
 * - Async upload with timeout
 */
export async function fastUploadToCloudinary(
  buffer: Buffer,
  folder: string = "telegram-maintenance"
): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary environment variables are missing");
  }

  const timestamp = Math.floor(Date.now() / 1000);

  // ⚡ OPTIMIZATION: Add transformation params for smaller, faster uploads
  // - w_1200: Max width 1200px (maintains aspect ratio)
  // - q_auto: Automatic quality optimization
  // - f_auto: Automatic format selection
  const uploadParams = `folder=${folder}&timestamp=${timestamp}&transformation=w_1200,q_auto,f_auto`;
  const signatureString = `${uploadParams}${apiSecret}`;
  const signature = await sha1(signatureString);

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)]));
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp.toString());
  form.append("folder", folder);
  form.append("signature", signature);
  form.append("transformation", "w_1200,q_auto,f_auto");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);

  try {
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const res = await fetch(uploadUrl, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    
    const result = await res.json();

    if (!result.secure_url) {
      console.error("[CLOUDINARY ERROR]", result);
      throw new Error("Cloudinary upload failed");
    }

    return result.secure_url;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Combined fast download + upload in single call
 * Returns URL or null if failed (non-blocking for main flow)
 */
export async function fastProcessTelegramPhoto(fileId: string): Promise<string | null> {
  try {
    const buffer = await fastDownloadTelegramFile(fileId);
    const url = await fastUploadToCloudinary(buffer);
    return url;
  } catch (err) {
    console.error("[FAST PHOTO] Processing failed:", err);
    return null;
  }
}

// Helper: SHA-1 hashing for Cloudinary signature
async function sha1(data: string): Promise<string> {
  const buffer = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest("SHA-1", buffer);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
