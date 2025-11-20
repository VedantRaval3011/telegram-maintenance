// app/api/masters/locations/[id]/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Location } from "@/models/Location";
import { connectToDB } from "@/lib/mongodb";
import { z } from "zod";

/**
 * GET /api/masters/locations/[id]
 * Get a single location by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDB();

    const location = await Location.findById(params.id)
      .populate("parentLocationId")
      .lean();

    if (!location) {
      return NextResponse.json(
        {
          success: false,
          error: "Location not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: location,
    });
  } catch (err) {
    console.error("[API] Failed to fetch location:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/masters/locations/[id]
 * Update a location
 */
const UpdateLocationSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["room", "building", "floor", "area", "other"]).optional(),
  code: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  parentLocationId: z.string().nullable().optional(),
  capacity: z.number().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDB();

    const body = await req.json();
    const validation = UpdateLocationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body",
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const location = await Location.findByIdAndUpdate(
      params.id,
      { $set: validation.data },
      { new: true, runValidators: true }
    ).populate("parentLocationId");

    if (!location) {
      return NextResponse.json(
        {
          success: false,
          error: "Location not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: location,
    });
  } catch (err) {
    console.error("[API] Failed to update location:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/masters/locations/[id]
 * Delete a location
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDB();

    const location = await Location.findByIdAndDelete(params.id);

    if (!location) {
      return NextResponse.json(
        {
          success: false,
          error: "Location not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Location deleted successfully",
      data: location,
    });
  } catch (err) {
    console.error("[API] Failed to delete location:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
