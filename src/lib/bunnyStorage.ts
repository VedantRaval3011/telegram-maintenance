/**
 * BunnyCDN Storage Module
 * 
 * Handles image uploads to BunnyCDN Storage Zone
 * Replacement for Cloudinary with better performance and pricing
 */

const UPLOAD_TIMEOUT = 15000; // 15 seconds max for upload

/**
 * Upload a buffer to BunnyCDN Storage
 * @param buffer - The file buffer to upload
 * @param folder - Optional folder path within the storage zone
 * @param extension - Optional file extension (default: 'jpg' for images)
 * @returns Promise resolving to the public CDN URL of the uploaded file
 */
export async function uploadToBunny(
  buffer: Buffer,
  folder: string = "telegram-maintenance",
  extension: string = "jpg"
): Promise<string> {
  const storageZone = process.env.BUNNY_STORAGE_ZONE!;
  const apiKey = process.env.BUNNY_STORAGE_API_KEY!;
  const storageHost = process.env.BUNNY_STORAGE_HOST!;
  // CDN hostname for public URLs (e.g., "myzone.b-cdn.net" or custom hostname)
  const cdnHostname = process.env.BUNNY_CDN_HOSTNAME!;

  if (!storageZone || !apiKey || !storageHost || !cdnHostname) {
    throw new Error("BunnyCDN environment variables are missing (BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_HOST, BUNNY_CDN_HOSTNAME)");
  }

  // Generate unique filename with timestamp and random string
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const filename = `${timestamp}_${randomStr}.${extension}`;
  
  // Construct the full path
  const filePath = folder ? `${folder}/${filename}` : filename;
  
  // BunnyCDN Storage API URL
  const uploadUrl = `https://${storageHost}/${storageZone}/${filePath}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);

  try {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "AccessKey": apiKey,
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array(buffer),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[BUNNY ERROR]", response.status, errorText);
      throw new Error(`BunnyCDN upload failed: ${response.status}`);
    }

    // Construct the public CDN URL using the configured CDN hostname
    const cdnUrl = `https://${cdnHostname}/${filePath}`;
    
    return cdnUrl;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Upload a buffer to BunnyCDN (alias for backward compatibility)
 * This maintains the same function signature as uploadBufferToCloudinary
 */
export async function uploadBufferToBunny(
  buffer: Buffer,
  folder: string = "telegram-maintenance"
): Promise<string> {
  return uploadToBunny(buffer, folder);
}

/**
 * Fast upload to BunnyCDN with the same interface as fastUploadToCloudinary
 * BunnyCDN is inherently fast, so this is essentially the same as uploadToBunny
 */
export async function fastUploadToBunny(
  buffer: Buffer,
  folder: string = "telegram-maintenance"
): Promise<string> {
  return uploadToBunny(buffer, folder);
}

/**
 * Delete a file from BunnyCDN Storage
 * @param filePath - The path to the file within the storage zone
 */
export async function deleteFromBunny(filePath: string): Promise<boolean> {
  const storageZone = process.env.BUNNY_STORAGE_ZONE!;
  const apiKey = process.env.BUNNY_STORAGE_API_KEY!;
  const storageHost = process.env.BUNNY_STORAGE_HOST!;

  if (!storageZone || !apiKey || !storageHost) {
    throw new Error("BunnyCDN environment variables are missing");
  }

  const deleteUrl = `https://${storageHost}/${storageZone}/${filePath}`;

  try {
    const response = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        "AccessKey": apiKey,
      },
    });

    return response.ok;
  } catch (err) {
    console.error("[BUNNY DELETE ERROR]", err);
    return false;
  }
}
