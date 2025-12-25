// app/api/tickets/[id]/assign/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Ticket } from "@/models/Ticket";
import { User } from "@/models/User";
import { connectToDB } from "@/lib/mongodb";

/**
 * POST /api/tickets/[id]/assign
 * Assign a user to a purchase ticket and send WhatsApp notification
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDB();

    const { id } = await params;
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    // Find the ticket by ticketId or _id
    let ticket = await Ticket.findOne({ ticketId: id });
    if (!ticket) {
      ticket = await Ticket.findById(id).catch(() => null);
    }
    if (!ticket) {
      return NextResponse.json(
        { success: false, error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Update ticket with assignment
    ticket.assignedTo = user._id;
    ticket.assignedAt = new Date();
    await ticket.save();

    // Prepare WhatsApp message
    const message = generateTicketMessage(ticket, user);
    
    // Generate WhatsApp URL
    let whatsappUrl = null;
    if (user.phone) {
      // Clean phone number - remove any non-digits and ensure it starts with country code
      const cleanPhone = user.phone.replace(/\D/g, '');
      const encodedMessage = encodeURIComponent(message);
      whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    }

    return NextResponse.json({
      success: true,
      data: {
        ticket: {
          ticketId: ticket.ticketId,
          assignedTo: user._id,
          assignedAt: ticket.assignedAt,
        },
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          phone: user.phone,
        },
        whatsappUrl,
        message,
      },
    });
  } catch (err) {
    console.error("[API] Failed to assign user to ticket:", err);
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
 * DELETE /api/tickets/[id]/assign
 * Unassign a user from a purchase ticket
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDB();

    const { id } = await params;

    // Find the ticket by ticketId or _id
    let ticket = await Ticket.findOne({ ticketId: id });
    if (!ticket) {
      ticket = await Ticket.findById(id).catch(() => null);
    }
    
    if (!ticket) {
      return NextResponse.json(
        { success: false, error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Unassign the user
    ticket.assignedTo = null;
    ticket.assignedAt = null;
    await ticket.save();

    return NextResponse.json({
      success: true,
      data: { ticketId: ticket.ticketId },
    });
  } catch (err) {
    console.error("[API] Failed to unassign user from ticket:", err);
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
 * Generate a formatted message for WhatsApp
 */
function generateTicketMessage(ticket: any, user: any): string {
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const priorityEmojis: Record<string, string> = {
    high: "🔴",
    medium: "🟡",
    low: "🟢",
  };
  const priorityEmoji = priorityEmojis[ticket.priority as string] || "🟡";

  let message = `🛒 *Purchase Request Assigned*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `Hello ${user.firstName || user.username || 'User'},\n\n`;
  message += `You have been assigned a new purchase request:\n\n`;
  message += `📋 *Ticket ID:* ${ticket.ticketId}\n`;
  message += `📝 *Description:* ${ticket.description || 'No description'}\n`;
  
  if (ticket.category) {
    const categoryDisplay = ticket.subCategory
      ? `${ticket.category} → ${ticket.subCategory}`
      : ticket.category;
    message += `📁 *Category:* ${categoryDisplay}\n`;
  }
  
  message += `${priorityEmoji} *Priority:* ${ticket.priority?.toUpperCase() || 'MEDIUM'}\n`;
  
  if (ticket.location) {
    message += `📍 *Location:* ${ticket.location}\n`;
  }
  
  message += `📅 *Assigned On:* ${dateStr}\n`;
  message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  message += `Please proceed with the purchase and update the status once completed.`;

  return message;
}
