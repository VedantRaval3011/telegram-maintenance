// app/api/tickets/route.ts
import { NextResponse } from "next/server";
import { connectToDB } from "../../../lib/mongodb";
import { Ticket } from "../../../models/Ticket";

export async function GET() {
  await connectToDB();
  const tickets = await Ticket.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json({ ok: true, data: tickets });
}

export async function POST(req: Request) {
  const body = await req.json();
  await connectToDB();
  const ticket = await Ticket.create(body);
  return NextResponse.json({ ok: true, data: ticket });
}
