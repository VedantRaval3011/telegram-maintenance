// app/api/masters/informations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Information } from "@/models/Information";

export async function GET(req: NextRequest) {
  try {
    await connectToDB();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";

    // Build query
    const query: any = {};
    if (search) {
      query.$or = [
        { content: { $regex: search, $options: "i" } },
        { createdBy: { $regex: search, $options: "i" } },
      ];
    }

    // Fetch data with pagination
    const [data, total] = await Promise.all([
      Information.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Information.countDocuments(query),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching informations:", error);
    return NextResponse.json(
      { error: "Failed to fetch informations" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDB();
    const body = await req.json();

    const information = await Information.create({
      content: body.content,
      createdBy: body.createdBy || "Unknown",
      telegramMessageId: body.telegramMessageId || null,
      telegramChatId: body.telegramChatId || null,
    });

    return NextResponse.json(information, { status: 201 });
  } catch (error) {
    console.error("Error creating information:", error);
    return NextResponse.json(
      { error: "Failed to create information" },
      { status: 500 }
    );
  }
}
