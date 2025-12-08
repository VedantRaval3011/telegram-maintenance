// app/api/masters/informations/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Information } from "@/models/Information";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDB();
    const { id } = await params;
    const information = await Information.findById(id).lean();

    if (!information) {
      return NextResponse.json(
        { error: "Information not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(information);
  } catch (error) {
    console.error("Error fetching information:", error);
    return NextResponse.json(
      { error: "Failed to fetch information" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDB();
    const { id } = await params;
    const result = await Information.findByIdAndDelete(id);

    if (!result) {
      return NextResponse.json(
        { error: "Information not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting information:", error);
    return NextResponse.json(
      { error: "Failed to delete information" },
      { status: 500 }
    );
  }
}
