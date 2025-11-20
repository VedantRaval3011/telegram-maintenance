export async function uploadBufferToCloudinary(
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

  // SIGNED UPLOAD
  const signatureString = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = await sha1(signatureString);

  const form = new FormData();
 form.append("file", new Blob([new Uint8Array(buffer)]));

  form.append("api_key", apiKey);
  form.append("timestamp", timestamp.toString());
  form.append("folder", folder);
  form.append("signature", signature);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  const res = await fetch(uploadUrl, {
    method: "POST",
    body: form,
  }).then((r) => r.json());

  if (!res.secure_url) {
    console.error("[CLOUDINARY ERROR]", res);
    throw new Error("Cloudinary upload failed");
  }

  return res.secure_url;
}

// Helper: SHA-1 hashing for Cloudinary signature
async function sha1(data: string) {
  const buffer = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest("SHA-1", buffer);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
