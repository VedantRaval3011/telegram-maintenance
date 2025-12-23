// app/api/masters/categories/[id]/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Category } from "@/models/Category";
import { Agency } from "@/models/AgencyMaster";
import { connectToDB } from "@/lib/mongodb";
import { z } from "zod";

/**
 * GET /api/masters/categories/[id]
 * Get a single category by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDB();

    const { id } = await params;
    const category = await Category.findById(id).lean();

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          error: "Category not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (err) {
    console.error("[API] Failed to fetch category:", err);
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
 * PUT /api/masters/categories/[id]
 * Update a category
 */
const UpdateCategorySchema = z.object({
  displayName: z.string().min(1).optional(),
  keywords: z.array(z.string()).optional(),
  description: z.string().nullable().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  agencies: z.array(z.string()).optional(),  // Array of agency ObjectId strings
  isActive: z.boolean().optional(),
  priority: z.number().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDB();

    const { id } = await params;
    const body = await req.json();
    const validation = UpdateCategorySchema.safeParse(body);

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

    const category = await Category.findByIdAndUpdate(
      id,
      { $set: validation.data },
      { new: true, runValidators: true }
    );

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          error: "Category not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (err) {
    console.error("[API] Failed to update category:", err);
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
 * DELETE /api/masters/categories/[id]
 * Delete a category and clean up all references
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDB();

    const { id } = await params;
    
    // First, remove this category from all agencies that have it linked
    await Agency.updateMany(
      { categories: id },
      { $pull: { categories: id } }
    );
    
    // Now delete the category
    const category = await Category.findByIdAndDelete(id);

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          error: "Category not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Category deleted successfully",
      data: category,
    });
  } catch (err) {
    console.error("[API] Failed to delete category:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
