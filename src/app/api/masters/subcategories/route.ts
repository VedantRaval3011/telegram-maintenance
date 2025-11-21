// app/api/masters/subcategories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { SubCategory } from "@/models/SubCategoryMaster";
import { z } from "zod";

export async function GET(req: NextRequest) {
  await connectToDB();

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");

  const query: any = {};
  if (categoryId) query.categoryId = categoryId;

  const data = await SubCategory.find(query).lean();

  return NextResponse.json({ success: true, data });
}

const CreateSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1),
  icon: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  await connectToDB();

  const body = await req.json();
  const check = CreateSchema.safeParse(body);

  if (!check.success) {
    return NextResponse.json(
      { success: false, error: check.error.flatten() },
      { status: 400 }
    );
  }

  const sub = await SubCategory.create(check.data);

  return NextResponse.json({ success: true, data: sub });
}
