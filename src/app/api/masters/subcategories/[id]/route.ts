// app/api/masters/subcategories/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { SubCategory } from "@/models/SubCategoryMaster";
import { z } from "zod";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectToDB();

  const { id } = await params;
  const data = await SubCategory.findById(id).lean();

  if (!data) return NextResponse.json({ success: false, error: "Not found" });

  return NextResponse.json({ success: true, data });
}

const UpdateSchema = z.object({
  name: z.string().optional(),
  icon: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectToDB();

  const { id } = await params;
  const body = await req.json();
  const check = UpdateSchema.safeParse(body);

  if (!check.success) {
    return NextResponse.json(
      { success: false, error: check.error.flatten() },
      { status: 400 }
    );
  }

  const data = await SubCategory.findByIdAndUpdate(
    id,
    { $set: check.data },
    { new: true }
  );

  if (!data)
    return NextResponse.json({ success: false, error: "Not found" });

  return NextResponse.json({ success: true, data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectToDB();

  const { id } = await params;

  const item = await SubCategory.findByIdAndDelete(id);
  if (!item)
    return NextResponse.json({ success: false, error: "Not found" });

  return NextResponse.json({ success: true, message: "Deleted" });
}
