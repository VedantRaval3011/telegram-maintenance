// app/api/masters/users/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { User } from "@/models/User";
import { connectToDB } from "@/lib/mongodb";
import { z } from "zod";

/**
 * GET /api/masters/users
 * List all users with pagination, search, and filtering
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDB();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const source = searchParams.get("source") || "";

    // Build query
    const query: any = {};

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ];
    }

    if (role) {
      query.role = role;
    }

    if (source) {
      query.source = source;
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(query)
        .populate("locationId")
        .sort({ lastSyncedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("[API] Failed to fetch users:", err);
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
 * POST /api/masters/users
 * Create a new user manually
 */
const CreateUserSchema = z.object({
  telegramId: z.number(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["creator", "administrator", "member", "restricted", "left", "kicked"]).optional(),
  locationId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    await connectToDB();

    const body = await req.json();
    const validation = CreateUserSchema.safeParse(body);

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

    // Check if user already exists
    const existing = await User.findOne({ telegramId: data.telegramId });
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: "User with this Telegram ID already exists",
        },
        { status: 409 }
      );
    }

    const user = await User.create({
      ...data,
      isBot: false,
      source: "manual",
      chatIds: [],
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      lastSyncedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (err) {
    console.error("[API] Failed to create user:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
