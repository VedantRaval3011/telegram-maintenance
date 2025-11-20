import { v2 as cloudinary } from "cloudinary";

export async function uploadBufferToCloudinary(buffer: Buffer, folder = "telegram-maintenance") {
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto" },
      (err, result) => {
        if (err) return reject(err);
        resolve(result!.secure_url);
      }
    );

    stream.end(buffer);
  });
}
