// app/api/masters/categories/seed/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Category } from "@/models/Category";
import { connectToDB } from "@/lib/mongodb";

/**
 * POST /api/masters/categories/seed
 * Seed initial categories
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDB();

    const defaultCategories = [
      {
        name: "electrical",
        displayName: "Electrical",
        keywords: ["light", "bulb", "electr", "switch", "plug", "socket", "fan", "power"],
        description: "Electrical issues including lights, fans, and power",
        color: "#F59E0B",
        icon: "⚡",
        priority: 5,
      },
      {
        name: "plumbing",
        displayName: "Plumbing",
        keywords: ["leak", "tap", "toilet", "flush", "plumb", "drain", "water"],
        description: "Plumbing issues including leaks, taps, and toilets",
        color: "#3B82F6",
        icon: "🚰",
        priority: 4,
      },
      {
        name: "furniture",
        displayName: "Furniture",
        keywords: ["table", "chair", "desk", "sofa", "broken", "furniture"],
        description: "Furniture repairs and replacements",
        color: "#8B5CF6",
        icon: "🪑",
        priority: 3,
      },
      {
        name: "cleaning",
        displayName: "Cleaning",
        keywords: ["spill", "trash", "clean", "dirty", "stain"],
        description: "Cleaning and sanitation issues",
        color: "#10B981",
        icon: "🧹",
        priority: 2,
      },
      {
        name: "hvac",
        displayName: "HVAC",
        keywords: ["ac", "aircon", "air conditioner", "temperature", "cooling", "heater"],
        description: "Heating, ventilation, and air conditioning",
        color: "#06B6D4",
        icon: "❄️",
        priority: 4,
      },
      {
        name: "paint",
        displayName: "Paint",
        keywords: ["paint", "wall", "ceiling", "color", "repaint", "painting"],
        description: "Painting and wall maintenance",
        color: "#EC4899",
        icon: "🎨",
        priority: 1,
      },
      {
        name: "other",
        displayName: "Other",
        keywords: [],
        description: "Other maintenance issues",
        color: "#6B7280",
        icon: "📋",
        priority: 0,
      },
    ];

    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const cat of defaultCategories) {
      try {
        const existing = await Category.findOne({ name: cat.name });
        if (existing) {
          results.skipped++;
          continue;
        }

        await Category.create(cat);
        results.created++;
      } catch (err) {
        results.errors.push(`${cat.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Categories seeded successfully",
      results,
    });
  } catch (err) {
    console.error("[API] Failed to seed categories:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
