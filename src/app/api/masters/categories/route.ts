// app/api/masters/categories/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Category } from "@/models/Category";
import { connectToDB } from "@/lib/mongodb";
import { z } from "zod";

/**
 * GET /api/masters/categories
 * List all categories with pagination, search, and filtering
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDB();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";
    const isActive = searchParams.get("isActive");

    // Build query
    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { displayName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (isActive !== null && isActive !== undefined && isActive !== "") {
      query.isActive = isActive === "true";
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const [categories, total] = await Promise.all([
      Category.aggregate([
        { $match: query },
        {
          $lookup: {
            from: "subcategories",
            localField: "_id",
            foreignField: "categoryId",
            as: "subs",
          },
        },
        {
          $addFields: {
            subCount: { $size: "$subs" },
          },
        },
        { $project: { subs: 0 } },
        { $sort: { priority: -1, name: 1 } },
        { $skip: skip },
        { $limit: limit },
      ]),
      Category.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: categories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("[API] Failed to fetch categories:", err);
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
 * POST /api/masters/categories
 * Create a new category
 */
const CreateCategorySchema = z.object({
  name: z.string().min(1, "Name is required").toLowerCase(),
  displayName: z.string().min(1, "Display name is required"),
  keywords: z.array(z.string()).default([]),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  priority: z.number().optional().default(0),
});

export async function POST(req: NextRequest) {
  try {
    await connectToDB();

    const body = await req.json();
    const validation = CreateCategorySchema.safeParse(body);

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

    // Check if category already exists
    const existing = await Category.findOne({ name: data.name });
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: "Category with this name already exists",
        },
        { status: 409 }
      );
    }

    const category = await Category.create(data);

    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (err) {
    console.error("[API] Failed to create category:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
