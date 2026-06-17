// app/api/informations/upload-media/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Information } from "@/models/Information";
import { uploadToBunny } from "@/lib/bunnyStorage";

const CONFIG = {
  maxImageSize: 10 * 1024 * 1024,
  maxVideoSize: 100 * 1024 * 1024,
  maxDocSize: 20 * 1024 * 1024,
  maxFilesPerUpload: 10,
  allowedImageTypes: ["image/jpeg", "image/jpg", "image/png"],
  allowedVideoTypes: ["video/mp4", "video/quicktime"],
  allowedDocTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "application/rtf",
  ],
};

/**
 * POST /api/informations/upload-media
 * Body (multipart): informationId, files[]
 * Uploads attachments to Bunny CDN and appends their URLs to the Information doc.
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDB();

    const formData = await req.formData();
    const informationId = formData.get("informationId") as string;
    const files = formData.getAll("files") as File[];

    if (
      !process.env.BUNNY_STORAGE_ZONE ||
      !process.env.BUNNY_STORAGE_API_KEY ||
      !process.env.BUNNY_STORAGE_HOST ||
      !process.env.BUNNY_CDN_HOSTNAME
    ) {
      return NextResponse.json(
        { ok: false, error: "BunnyCDN is not configured on the server." },
        { status: 500 }
      );
    }

    if (!informationId) {
      return NextResponse.json(
        { ok: false, error: "informationId is required" },
        { status: 400 }
      );
    }
    if (!files || files.length === 0) {
      return NextResponse.json({ ok: false, error: "No files provided" }, { status: 400 });
    }
    if (files.length > CONFIG.maxFilesPerUpload) {
      return NextResponse.json(
        { ok: false, error: `Maximum ${CONFIG.maxFilesPerUpload} files allowed per upload` },
        { status: 400 }
      );
    }

    const information = await Information.findById(informationId);
    if (!information) {
      return NextResponse.json(
        { ok: false, error: "Information entry not found" },
        { status: 404 }
      );
    }

    const uploadedUrls: string[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const fileType = file.type;
      const isImage = CONFIG.allowedImageTypes.includes(fileType);
      const isVideo = CONFIG.allowedVideoTypes.includes(fileType);
      const isDoc = CONFIG.allowedDocTypes.includes(fileType);

      if (!isImage && !isVideo && !isDoc) {
        errors.push(`${file.name}: Unsupported file type (${fileType})`);
        continue;
      }
      if (isImage && file.size > CONFIG.maxImageSize) {
        errors.push(`${file.name}: Image exceeds limit`);
        continue;
      }
      if (isVideo && file.size > CONFIG.maxVideoSize) {
        errors.push(`${file.name}: Video exceeds limit`);
        continue;
      }
      if (isDoc && file.size > CONFIG.maxDocSize) {
        errors.push(`${file.name}: Document exceeds limit`);
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        let extension = "bin";
        if (fileType === "image/png") extension = "png";
        else if (fileType === "image/jpeg" || fileType === "image/jpg") extension = "jpg";
        else if (fileType === "video/mp4") extension = "mp4";
        else if (fileType === "video/quicktime") extension = "mov";
        else if (fileType === "application/pdf") extension = "pdf";
        else if (fileType.includes("spreadsheetml")) extension = "xlsx";
        else if (fileType.includes("wordprocessingml")) extension = "docx";
        else {
          const parts = file.name.split(".");
          if (parts.length > 1) extension = parts.pop() || "bin";
        }

        const folder = `telegram-maintenance/informations/${informationId}`;
        const url = await uploadToBunny(buffer, folder, extension);
        uploadedUrls.push(url);
      } catch (uploadError) {
        console.error(`[INFO UPLOAD ERROR] ${file.name}:`, uploadError);
        errors.push(`${file.name}: Upload failed`);
      }
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No files were uploaded successfully", details: errors },
        { status: 400 }
      );
    }

    const docExtensions = ["pdf", "xlsx", "xls", "docx", "doc", "txt", "rtf", "ppt", "pptx"];
    const imageUrls = uploadedUrls.filter(
      (u) => u.endsWith(".jpg") || u.endsWith(".jpeg") || u.endsWith(".png")
    );
    const videoUrls = uploadedUrls.filter((u) => u.endsWith(".mp4") || u.endsWith(".mov"));
    const docUrls = uploadedUrls.filter((u) =>
      docExtensions.some((ext) => u.toLowerCase().endsWith(`.${ext}`))
    );

    information.photos = [...(information.photos || []), ...imageUrls];
    information.videos = [...(information.videos || []), ...videoUrls];
    information.documents = [...(information.documents || []), ...docUrls];
    await information.save();

    return NextResponse.json({
      ok: true,
      data: {
        informationId,
        uploadedCount: uploadedUrls.length,
        urls: uploadedUrls,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error("[INFO MEDIA UPLOAD ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error during upload" },
      { status: 500 }
    );
  }
}
