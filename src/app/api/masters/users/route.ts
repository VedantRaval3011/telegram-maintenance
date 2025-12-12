// app/api/masters/users/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { User } from "@/models/User";
import { Location } from "@/models/Location";
import { SubCategory } from "@/models/SubCategoryMaster";
import { connectToDB } from "@/lib/mongodb";
import { z } from "zod";

// Ensure models are registered for User.populate() to work
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _LocationModel = Location;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _SubCategoryModel = SubCategory;

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
        .populate({
          path: "subCategories",
          populate: {
            path: "categoryId",
            select: "displayName color",
          },
        })
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
  telegramId: z.number().optional(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(["creator", "administrator", "member", "restricted", "left", "kicked"]).optional(),
  locationId: z.string().optional(),
  subCategories: z.array(z.string()).optional(),
  _id: z.string().optional(), // For updates
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

    // Check if updating existing user
    if (data._id) {
      const updatedUser = await User.findByIdAndUpdate(
        data._id,
        {
          username: data.username,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: data.role,
          locationId: data.locationId || null,
          subCategories: data.subCategories || [],
          lastSyncedAt: new Date(),
        },
        { new: true }
      )
        .populate("locationId")
        .populate({
          path: "subCategories",
          populate: {
            path: "categoryId",
            select: "displayName color",
          },
        });

      if (!updatedUser) {
        return NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: updatedUser,
      });
    }

    // Creating new user - telegramId is required
    if (!data.telegramId) {
      return NextResponse.json(
        { success: false, error: "Telegram ID is required for new users" },
        { status: 400 }
      );
    }

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
      telegramId: data.telegramId,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      role: data.role,
      locationId: data.locationId || null,
      subCategories: data.subCategories || [],
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
