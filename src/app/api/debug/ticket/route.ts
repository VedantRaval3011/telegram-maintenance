// API endpoint to debug and fix ticket data
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Ticket } from "@/models/Ticket";

export async function GET(req: NextRequest) {
  await connectToDB();
  
  const { searchParams } = new URL(req.url);
  const ticketId = searchParams.get('ticketId');
  
  if (!ticketId) {
    return NextResponse.json({ error: "ticketId parameter required" }, { status: 400 });
  }
  
  const ticket = await Ticket.findOne({ ticketId: ticketId.toUpperCase() });
  
  if (!ticket) {
    return NextResponse.json({ error: `Ticket ${ticketId} not found` }, { status: 404 });
  }
  
  return NextResponse.json({
    ticketId: ticket.ticketId,
    description: ticket.description,
    photos: ticket.photos,
    videos: ticket.videos,
    photosCount: ticket.photos?.length || 0,
    videosCount: ticket.videos?.length || 0,
    category: ticket.category,
    subCategory: ticket.subCategory,
    priority: ticket.priority,
    location: ticket.location,
    agencyName: ticket.agencyName,
    createdAt: ticket.createdAt,
    status: ticket.status,
  });
}

// POST to restore/update ticket data
export async function POST(req: NextRequest) {
  await connectToDB();
  
  const body = await req.json();
  const { ticketId, description, photos, videos } = body;
  
  if (!ticketId) {
    return NextResponse.json({ error: "ticketId required" }, { status: 400 });
  }
  
  const updateData: any = {};
  if (description !== undefined) updateData.description = description;
  if (photos !== undefined) updateData.photos = photos;
  if (videos !== undefined) updateData.videos = videos;
  
  const ticket = await Ticket.findOneAndUpdate(
    { ticketId: ticketId.toUpperCase() },
    updateData,
    { new: true }
  );
  
  if (!ticket) {
    return NextResponse.json({ error: `Ticket ${ticketId} not found` }, { status: 404 });
  }
  
  return NextResponse.json({
    success: true,
    ticketId: ticket.ticketId,
    description: ticket.description,
    photos: ticket.photos,
    videos: ticket.videos,
    photosCount: ticket.photos?.length || 0,
    videosCount: ticket.videos?.length || 0,
  });
}
