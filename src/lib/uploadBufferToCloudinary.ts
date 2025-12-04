/**
 * Upload Buffer to BunnyCDN
 * 
 * This file maintains backward compatibility with the old Cloudinary interface
 * while using BunnyCDN under the hood.
 */

import { uploadToBunny } from "./bunnyStorage";

/**
 * Upload a buffer to BunnyCDN
 * @deprecated Use uploadToBunny from bunnyStorage.ts directly
 */
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string = "telegram-maintenance"
): Promise<string> {
  // Redirect to BunnyCDN
  return uploadToBunny(buffer, folder);
}
