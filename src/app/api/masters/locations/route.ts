// app/api/masters/locations/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Location } from "@/models/Location";
import { connectToDB } from "@/lib/mongodb";
import { z } from "zod";

/**
 * GET /api/masters/locations
 * List all locations with pagination, search, and filtering
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDB();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "";
    const isActive = searchParams.get("isActive");

    // Build query
    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (type) {
      query.type = type;
    }

    if (isActive !== null && isActive !== undefined && isActive !== "") {
      query.isActive = isActive === "true";
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    
    console.log(`[LOCATIONS API] Fetching locations: page=${page}, limit=${limit}, query=`, JSON.stringify(query));
    
    const startTime = Date.now();
    const locationsPromise = Location.find(query)
      .populate("parentLocationId", "name type isActive")
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .maxTimeMS(20000) // 20s timeout for query
      .lean();
      
    const countPromise = Location.countDocuments(query).maxTimeMS(20000);
    
    const [locations, total] = await Promise.all([locationsPromise, countPromise]);
    
    const duration = Date.now() - startTime;
    console.log(`[LOCATIONS API] Fetch completed in ${duration}ms. Locations: ${locations.length}, Total: ${total}`);

    return NextResponse.json({
      success: true,
      data: locations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("[API] Failed to fetch locations:", err);
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
 * POST /api/masters/locations
 * Create a new location
 */
const CreateLocationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  parentLocationId: z.string().nullable().optional(),
  capacity: z.number().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  try {
    await connectToDB();

    const body = await req.json();
    const validation = CreateLocationSchema.safeParse(body);

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

    const data = validation.data;

    // Check if location with same code already exists
    if (data.code) {
      const existing = await Location.findOne({ code: data.code });
      if (existing) {
        return NextResponse.json(
          {
            success: false,
            error: "Location with this code already exists",
          },
          { status: 409 }
        );
      }
    }

    const location = await Location.create(data);

    return NextResponse.json({
      success: true,
      data: location,
    });
  } catch (err) {
    console.error("[API] Failed to create location:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
