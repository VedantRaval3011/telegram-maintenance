// app/api/tickets/upload-media/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Ticket } from "@/models/Ticket";
import { uploadToBunny } from "@/lib/bunnyStorage";

// Configuration for file limits
const CONFIG = {
  maxImageSize: 10 * 1024 * 1024, // 10MB for images
  maxVideoSize: 100 * 1024 * 1024, // 100MB for videos
  maxFilesPerUpload: 10,
  allowedImageTypes: ["image/jpeg", "image/jpg", "image/png"],
  allowedVideoTypes: ["video/mp4", "video/quicktime"], // MP4 and MOV
};

interface MediaUploadMetadata {
  ticketId: string;
  mediaType: "image" | "video";
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
    const mediaField = formData.get("mediaField") as string || "photos"; // 'photos' or 'videos'
    const files = formData.getAll("files") as File[];

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

      if (!isImage && !isVideo) {
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

        // Upload to Bunny CDN
        const folder = `telegram-maintenance/manual-uploads/${ticketId}`;
        const url = await uploadToBunny(buffer, folder, extension);
        
        uploadedUrls.push(url);

        // Create metadata
        metadata.push({
          ticketId,
          mediaType: isVideo ? "video" : "image",
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

    // Separate URLs by type based on extension
    const imageUrls = uploadedUrls.filter(url => 
      url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png')
    );
    const videoUrls = uploadedUrls.filter(url => 
      url.endsWith('.mp4') || url.endsWith('.mov')
    );

    // Update ticket with new media
    if (mediaField === "completionPhotos" || mediaField === "completionVideos") {
      // Add to completion media
      if (imageUrls.length > 0) {
        ticket.completionPhotos = [...(ticket.completionPhotos || []), ...imageUrls];
      }
      if (videoUrls.length > 0) {
        ticket.completionVideos = [...(ticket.completionVideos || []), ...videoUrls];
      }
    } else {
      // Add to regular photos/videos
      if (imageUrls.length > 0) {
        ticket.photos = [...(ticket.photos || []), ...imageUrls];
      }
      if (videoUrls.length > 0) {
        ticket.videos = [...(ticket.videos || []), ...videoUrls];
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
      maxFilesPerUpload: CONFIG.maxFilesPerUpload,
      allowedImageTypes: CONFIG.allowedImageTypes,
      allowedVideoTypes: CONFIG.allowedVideoTypes,
      allowedImageExtensions: ["jpg", "jpeg", "png"],
      allowedVideoExtensions: ["mp4", "mov"],
    },
  });
}
