// app/api/masters/notifications/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { NotificationMaster } from "@/models/NotificationMaster";
import mongoose from "mongoose";

/**
 * GET - List all notification rules
 * Query params: type, active, userId, agencyId
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDB();

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type");
    const active = searchParams.get("active");
    const userId = searchParams.get("userId");
    const agencyId = searchParams.get("agencyId");

    // Build query filter
    const filter: any = {};
    if (type) filter.type = type;
    if (active !== null) filter.active = active === "true";
    if (userId) filter.userId = new mongoose.Types.ObjectId(userId);
    if (agencyId) filter.agencyId = new mongoose.Types.ObjectId(agencyId);

    const rules = await NotificationMaster.find(filter)
      .populate("userId", "firstName lastName username phone")
      .populate("agencyId", "name phone")
      .populate("subCategoryIds", "name")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ ok: true, data: rules });
  } catch (error: any) {
    console.error("[Notification Master API] GET error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST - Create new notification rule
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDB();

    const body = await req.json();

    const {
      type,
      userId,
      agencyId,
      subCategoryIds,
      notifyBeforeDays,
      reminderAfterHours,
      maxReminders,
      whatsappTemplateId,
      webhookCallbackUrl,
      active
    } = body;

    // Validation
    if (!type || !["user", "agency"].includes(type)) {
      return NextResponse.json(
        { ok: false, error: "Invalid type. Must be 'user' or 'agency'" },
        { status: 400 }
      );
    }

    if (type === "user" && !userId) {
      return NextResponse.json(
        { ok: false, error: "userId is required for user notifications" },
        { status: 400 }
      );
    }

    if (type === "agency" && !agencyId) {
      return NextResponse.json(
        { ok: false, error: "agencyId is required for agency notifications" },
        { status: 400 }
      );
    }

    // Create new rule
    const rule = new NotificationMaster({
      type,
      userId: userId ? new mongoose.Types.ObjectId(userId) : null,
      agencyId: agencyId ? new mongoose.Types.ObjectId(agencyId) : null,
      subCategoryIds: subCategoryIds?.map((id: string) => new mongoose.Types.ObjectId(id)) || [],
      notifyBeforeDays: notifyBeforeDays ?? 1,
      reminderAfterHours: reminderAfterHours ?? 12,
      maxReminders: maxReminders ?? 3,
      whatsappTemplateId: whatsappTemplateId || null,
      webhookCallbackUrl: webhookCallbackUrl || null,
      active: active ?? true
    });

    await rule.save();

    // Populate for response
    await rule.populate("userId", "firstName lastName username phone");
    await rule.populate("agencyId", "name phone");
    await rule.populate("subCategoryIds", "name");

    return NextResponse.json({ ok: true, data: rule }, { status: 201 });
  } catch (error: any) {
    console.error("[Notification Master API] POST error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

/**
 * PATCH - Update existing notification rule
 */
export async function PATCH(req: NextRequest) {
  try {
    await connectToDB();

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "id is required" },
        { status: 400 }
      );
    }

    // Convert ObjectId fields if present
    if (updates.userId) {
      updates.userId = new mongoose.Types.ObjectId(updates.userId);
    }
    if (updates.agencyId) {
      updates.agencyId = new mongoose.Types.ObjectId(updates.agencyId);
    }
    if (updates.subCategoryIds) {
      updates.subCategoryIds = updates.subCategoryIds.map(
        (id: string) => new mongoose.Types.ObjectId(id)
      );
    }

    const rule = await NotificationMaster.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    )
      .populate("userId", "firstName lastName username phone")
      .populate("agencyId", "name phone")
      .populate("subCategoryIds", "name");

    if (!rule) {
      return NextResponse.json(
        { ok: false, error: "Rule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: rule });
  } catch (error: any) {
    console.error("[Notification Master API] PATCH error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE - Deactivate (soft delete) notification rule
 */
export async function DELETE(req: NextRequest) {
  try {
    await connectToDB();

    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "id is required" },
        { status: 400 }
      );
    }

    const rule = await NotificationMaster.findByIdAndUpdate(
      id,
      { $set: { active: false } },
      { new: true }
    );

    if (!rule) {
      return NextResponse.json(
        { ok: false, error: "Rule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: rule });
  } catch (error: any) {
    console.error("[Notification Master API] DELETE error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
