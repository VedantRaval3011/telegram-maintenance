import { connectToDB } from "./src/lib/mongodb";
import { Ticket } from "./src/models/Ticket";

async function testReopen() {
  await connectToDB();
  const ticketId = "T397";
  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    console.log("Ticket not found");
    process.exit(1);
  }
  
  console.log("Current status:", ticket.status);
  console.log("Current history count:", ticket.reopenedHistory.length);

  // Simulate reopen logic from API
  const reopenedBy = "TestUser";
  const reopenedReason = "Test Reason";
  const startTime = ticket.completedAt || ticket.createdAt;
  const phaseDuration = startTime ? (Date.now() - new Date(startTime).getTime()) : 0;

  ticket.reopenedHistory.push({
    reopenedAt: new Date(),
    reopenedBy: reopenedBy,
    reopenedReason: reopenedReason,
    previousStatus: ticket.status,
    previousCompletedAt: ticket.completedAt,
    previousCompletedBy: ticket.completedBy,
    phaseDuration: phaseDuration
  });

  ticket.status = "PENDING";
  ticket.completedBy = null;
  ticket.completedAt = null;
  
  await ticket.save();
  
  const updatedTicket = await Ticket.findOne({ ticketId });
  if (!updatedTicket) {
    console.log("Updated ticket not found");
    process.exit(1);
  }
  console.log("New status:", updatedTicket.status);
  console.log("New history count:", updatedTicket.reopenedHistory.length);
  
  process.exit(0);
}

testReopen();
