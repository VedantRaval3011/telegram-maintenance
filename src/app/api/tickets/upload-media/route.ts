// app/api/tickets/upload-media/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Ticket } from "@/models/Ticket";
import { uploadToBunny } from "@/lib/bunnyStorage";

// Configuration for file limits
const CONFIG = {
  maxImageSize: 10 * 1024 * 1024, // 10MB for images
  maxVideoSize: 100 * 1024 * 1024, // 100MB for videos
  maxDocSize: 20 * 1024 * 1024, // 20MB for documents
  maxFilesPerUpload: 10,
  allowedImageTypes: ["image/jpeg", "image/jpg", "image/png"],
  allowedVideoTypes: ["video/mp4", "video/quicktime"], // MP4 and MOV
  allowedDocTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/msword", // .doc
    "application/vnd.ms-excel", // .xls
    "application/vnd.ms-powerpoint", // .ppt
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
    "text/plain", // .txt
    "application/rtf", // .rtf
  ],
};

interface MediaUploadMetadata {
  ticketId: string;
  mediaType: "image" | "video" | "document";
  uploadedBy: string;
  uploadTimestamp: Date;
  source: "manual_upload";
  originalCaptureMode: "offline_recovery";
}

export async function POST(req: NextRequest) {
  try {
    await connectToDB();

    const formData = await req.formData();
    const ticketId = formData.get("ticketId") as string;
    const uploadedBy = formData.get("uploadedBy") as string || "Dashboard Admin";
    const mediaField = formData.get("mediaField") as string || "photos"; // 'photos', 'videos', or 'documents'
    const files = formData.getAll("files") as File[];

    // Check if BunnyCDN is configured
    if (!process.env.BUNNY_STORAGE_ZONE || !process.env.BUNNY_STORAGE_API_KEY || !process.env.BUNNY_STORAGE_HOST || !process.env.BUNNY_CDN_HOSTNAME) {
      return NextResponse.json(
        { 
          ok: false, 
          error: "BunnyCDN is not configured on the server. Please add BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_HOST, and BUNNY_CDN_HOSTNAME to your .env.local file." 
        },
        { status: 500 }
      );
    }

    // Validation
    if (!ticketId) {
      return NextResponse.json(
        { ok: false, error: "Ticket ID is required" },
        { status: 400 }
      );
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No files provided" },
        { status: 400 }
      );
    }

    if (files.length > CONFIG.maxFilesPerUpload) {
      return NextResponse.json(
        { ok: false, error: `Maximum ${CONFIG.maxFilesPerUpload} files allowed per upload` },
        { status: 400 }
      );
    }

    // Find the ticket
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) {
      return NextResponse.json(
        { ok: false, error: `Ticket ${ticketId} not found` },
        { status: 404 }
      );
    }

    const uploadedUrls: string[] = [];
    const errors: string[] = [];
    const metadata: MediaUploadMetadata[] = [];

    for (const file of files) {
      const fileType = file.type;
      const fileSize = file.size;
      const fileName = file.name;

      // Determine if image or video
      const isImage = CONFIG.allowedImageTypes.includes(fileType);
      const isVideo = CONFIG.allowedVideoTypes.includes(fileType);
      const isDoc = CONFIG.allowedDocTypes.includes(fileType);

      if (!isImage && !isVideo && !isDoc) {
        errors.push(`${fileName}: Unsupported file type (${fileType})`);
        continue;
      }

      // Check file size limits
      if (isImage && fileSize > CONFIG.maxImageSize) {
        errors.push(`${fileName}: Image exceeds ${CONFIG.maxImageSize / (1024 * 1024)}MB limit`);
        continue;
      }

      if (isVideo && fileSize > CONFIG.maxVideoSize) {
        errors.push(`${fileName}: Video exceeds ${CONFIG.maxVideoSize / (1024 * 1024)}MB limit`);
        continue;
      }

      if (isDoc && fileSize > CONFIG.maxDocSize) {
        errors.push(`${fileName}: Document exceeds ${CONFIG.maxDocSize / (1024 * 1024)}MB limit`);
        continue;
      }

      try {
        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Determine extension
        let extension = "jpg";
        if (fileType === "image/png") extension = "png";
        else if (fileType === "image/jpeg" || fileType === "image/jpg") extension = "jpg";
        else if (fileType === "video/mp4") extension = "mp4";
        else if (fileType === "video/quicktime") extension = "mov";
        else if (fileType === "application/pdf") extension = "pdf";
        else if (fileType.includes("spreadsheetml")) extension = "xlsx";
        else if (fileType.includes("wordprocessingml")) extension = "docx";
        else {
          // Extract extension from fileName as fallback
          const parts = fileName.split('.');
          if (parts.length > 1) extension = parts.pop() || "bin";
          else extension = "bin";
        }

        // Upload to Bunny CDN
        const folder = `telegram-maintenance/manual-uploads/${ticketId}`;
        const url = await uploadToBunny(buffer, folder, extension);
        
        uploadedUrls.push(url);

        // Create metadata
        metadata.push({
          ticketId,
          mediaType: isVideo ? "video" : (isDoc ? "document" : "image"),
          uploadedBy,
          uploadTimestamp: new Date(),
          source: "manual_upload",
          originalCaptureMode: "offline_recovery",
        });
      } catch (uploadError) {
        console.error(`[UPLOAD ERROR] ${fileName}:`, uploadError);
        errors.push(`${fileName}: Upload failed`);
      }
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No files were uploaded successfully", details: errors },
        { status: 400 }
      );
    }

    // Separate URLs by type
    const docExtensions = ["pdf", "xlsx", "xls", "docx", "doc", "txt", "rtf", "ppt", "pptx"];
    const imageUrls = uploadedUrls.filter(url => 
      url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png')
    );
    const videoUrls = uploadedUrls.filter(url => 
      url.endsWith('.mp4') || url.endsWith('.mov')
    );
    const docUrls = uploadedUrls.filter(url => 
      docExtensions.some(ext => url.toLowerCase().endsWith(`.${ext}`))
    );

    // Update ticket with new media
    if (mediaField.startsWith("completion")) {
      // Add to completion media
      if (imageUrls.length > 0) {
        ticket.completionPhotos = [...(ticket.completionPhotos || []), ...imageUrls];
      }
      if (videoUrls.length > 0) {
        ticket.completionVideos = [...(ticket.completionVideos || []), ...videoUrls];
      }
      if (docUrls.length > 0) {
        ticket.completionDocuments = [...(ticket.completionDocuments || []), ...docUrls];
      }
    } else {
      // Add to regular media
      if (imageUrls.length > 0) {
        ticket.photos = [...(ticket.photos || []), ...imageUrls];
      }
      if (videoUrls.length > 0) {
        ticket.videos = [...(ticket.videos || []), ...videoUrls];
      }
      if (docUrls.length > 0) {
        ticket.documents = [...(ticket.documents || []), ...docUrls];
      }
    }

    await ticket.save();

    return NextResponse.json({
      ok: true,
      data: {
        ticketId,
        uploadedCount: uploadedUrls.length,
        imageCount: imageUrls.length,
        videoCount: videoUrls.length,
        docCount: docUrls.length,
        urls: uploadedUrls,
        metadata,
        errors: errors.length > 0 ? errors : undefined,
      },
      message: `Successfully uploaded ${uploadedUrls.length} file(s) to Ticket #${ticketId}`,
    });

  } catch (error) {
    console.error("[MEDIA UPLOAD ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error during upload" },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch upload configuration
export async function GET() {
  return NextResponse.json({
    ok: true,
    config: {
      maxImageSize: CONFIG.maxImageSize,
      maxVideoSize: CONFIG.maxVideoSize,
      maxDocSize: CONFIG.maxDocSize,
      maxFilesPerUpload: CONFIG.maxFilesPerUpload,
      allowedImageTypes: CONFIG.allowedImageTypes,
      allowedVideoTypes: CONFIG.allowedVideoTypes,
      allowedDocTypes: CONFIG.allowedDocTypes,
      allowedImageExtensions: ["jpg", "jpeg", "png"],
      allowedVideoExtensions: ["mp4", "mov"],
      allowedDocExtensions: ["pdf", "xlsx", "xls", "docx", "doc", "txt", "rtf", "ppt", "pptx"],
    },
  });
}
