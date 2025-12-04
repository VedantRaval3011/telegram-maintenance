/**
 * Image Upload Module
 * 
 * This file maintains backward compatibility with the old Cloudinary interface
 * while using BunnyCDN under the hood.
 * 
 * @deprecated Use bunnyStorage.ts directly for new code
 */

import { uploadToBunny } from "./bunnyStorage";

/**
 * Upload a file to BunnyCDN (previously Cloudinary)
 * @param filePath Local path to the file
 * @param folder Optional folder in BunnyCDN
 * @returns Promise resolving to the URL of the uploaded image
 * @deprecated Use uploadToBunny from bunnyStorage.ts instead
 */
export async function uploadToCloudinary(
  filePath: string,
  folder: string = "telegram-maintenance"
): Promise<string> {
  // Read file and upload to BunnyCDN
  const fs = await import("fs");
  const buffer = fs.readFileSync(filePath);
  return uploadToBunny(buffer, folder);
}
