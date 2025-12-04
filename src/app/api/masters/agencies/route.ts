import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Agency } from "@/models/AgencyMaster";

/**
 * GET - Fetch all active agencies
 */
export async function GET() {
  try {
    await connectToDB();
    const agencies = await Agency.find({ isActive: true })
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({ success: true, data: agencies });
  } catch (error: any) {
    console.error("Error fetching agencies:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Create or update an agency
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDB();
    const body = await req.json();
    const { _id, name, phone, email, notes } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Agency name is required" },
        { status: 400 }
      );
    }

    if (_id) {
      // Update existing
      const updated = await Agency.findByIdAndUpdate(
        _id,
        { name: name.trim(), phone, email, notes },
        { new: true }
      );
      if (!updated) {
        return NextResponse.json(
          { success: false, error: "Agency not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: updated });
    } else {
      // Create new
      const agency = await Agency.create({
        name: name.trim(),
        phone: phone || "",
        email: email || "",
        notes: notes || "",
      });
      return NextResponse.json({ success: true, data: agency });
    }
  } catch (error: any) {
    console.error("Error saving agency:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Soft delete an agency
 */
export async function DELETE(req: NextRequest) {
  try {
    await connectToDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Agency ID is required" },
        { status: 400 }
      );
    }

    const updated = await Agency.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Agency not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Agency deleted" });
  } catch (error: any) {
    console.error("Error deleting agency:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
