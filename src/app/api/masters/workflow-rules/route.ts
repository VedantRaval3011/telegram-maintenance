import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { WorkflowRule } from "@/models/WorkflowRuleMaster";
import { connectToDB } from "@/lib/mongodb";
import { z } from "zod";

/**
 * GET /api/masters/workflow-rules
 * List all workflow rules, optionally filtered by categoryId
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDB();

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");

    const query: any = {};
    if (categoryId) {
      query.categoryId = categoryId;
    }

    const rules = await WorkflowRule.find(query)
      .populate("categoryId", "name displayName")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: rules,
    });
  } catch (err) {
    console.error("[API] Failed to fetch workflow rules:", err);
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
 * POST /api/masters/workflow-rules
 * Create or Update a workflow rule for a category
 */
const WorkflowRuleSchemaVal = z.object({
  categoryId: z.string().min(1, "Category is required"),
  hasSubcategories: z.boolean().default(false),
  requiresLocation: z.boolean().default(false),
  requiresSourceLocation: z.boolean().default(false),
  requiresTargetLocation: z.boolean().default(false),
  requiresAgency: z.boolean().default(false),
  requiresAgencyDate: z.boolean().default(false),
  additionalFields: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      type: z.enum(["text", "number", "date", "photo", "select"]),
      options: z.array(z.string()).optional(),
    })
  ).default([]),
});

export async function POST(req: NextRequest) {
  try {
    await connectToDB();

    const body = await req.json();
    const validation = WorkflowRuleSchemaVal.safeParse(body);

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

    // Check if rule exists for this category
    let rule = await WorkflowRule.findOne({ categoryId: data.categoryId });

    if (rule) {
      // Update existing
      rule.set(data);
      await rule.save();
    } else {
      // Create new
      rule = await WorkflowRule.create(data);
    }

    return NextResponse.json({
      success: true,
      data: rule,
    });
  } catch (err) {
    console.error("[API] Failed to save workflow rule:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectToDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });
    }

    await WorkflowRule.findByIdAndDelete(id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
