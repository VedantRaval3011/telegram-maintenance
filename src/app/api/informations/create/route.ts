// app/api/informations/create/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Information } from "@/models/Information";
import { getSession } from "@/lib/auth";

/**
 * POST /api/informations/create
 *
 * Dashboard counterpart of the Telegram `/info` command: saves an entry straight
 * into the Information module instead of creating a maintenance ticket.
 * Body: { content, type? ("general" | "audit") }
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDB();

    const session = await getSession();
    const body = await req.json();
    const content = (body?.content || "").trim();
    const type = body?.type === "audit" ? "audit" : "general";

    if (!content) {
      return NextResponse.json(
        { ok: false, error: "Content is required" },
        { status: 400 }
      );
    }

    const createdBy = session?.displayName || session?.username || "Dashboard Admin";

    const information = await Information.create({
      content,
      createdBy,
      type,
      photos: [],
      videos: [],
      documents: [],
    });

    return NextResponse.json({ ok: true, data: information }, { status: 201 });
  } catch (err) {
    console.error("[Create Information] Failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
